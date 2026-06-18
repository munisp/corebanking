import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { cn } from "@/lib/utils";
import apiClient from "@/services/api";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  balance: number;
  currency: string;
}

interface TransferApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  standalone?: boolean;
}

export default function TransferApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  standalone = false,
}: TransferApplicationFormProps) {
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [fromAccountComboOpen, setFromAccountComboOpen] = useState(false);
  const [toAccountComboOpen, setToAccountComboOpen] = useState(false);

  const [formData, setFormData] = useState({
    from_account_id: "",
    from_account_number: "",
    to_account_id: "",
    to_account_number: "",
    amount: "",
    currency: "NGN",
    transfer_type: "internal",
    description: "",
    beneficiary_name: "",
    beneficiary_bank: "",
    beneficiary_bank_code: "",
    narration: "",
    pin: "",
  });

  // Fetch accounts on component mount
  useEffect(() => {
    const fetchAccounts = async () => {
      setAccountsLoading(true);
      try {
        const response = await apiClient.get("/account/account/all");
        const data = response.data;

        let accountsData: any[] = [];
        if (Array.isArray(data)) {
          accountsData = data;
        } else if (Array.isArray(data.account)) {
          accountsData = data.account;
        } else if (Array.isArray(data.accounts)) {
          accountsData = data.accounts;
        } else if (Array.isArray(data.data)) {
          accountsData = data.data;
        }

        const mappedAccounts: Account[] = accountsData
          .filter((account: any) => account.status === "active") // Only show active accounts
          .map((account: any) => ({
            id: String(account.id || account.account_id),
            account_number: account.account_number || "",
            account_name: account.name || account.account_name || "",
            account_type: account.account_type || account.type || "",
            balance: account.balance || 0,
            currency: account.account_currency || account.currency || "NGN",
          }));

        setAccounts(mappedAccounts);
      } catch (error: any) {
        console.error("Failed to fetch accounts:", error);
        toast.error("Failed to load accounts");
      } finally {
        setAccountsLoading(false);
      }
    };

    if (open || standalone) {
      fetchAccounts();
    }
  }, [open, standalone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.from_account_id) {
        toast.error("Please select source account");
        setLoading(false);
        return;
      }

      if (formData.transfer_type === "internal" && !formData.to_account_id) {
        toast.error("Please select destination account");
        setLoading(false);
        return;
      }

      if (
        formData.transfer_type === "external" &&
        !formData.to_account_number
      ) {
        toast.error("Please enter destination account number");
        setLoading(false);
        return;
      }

      if (!formData.pin || formData.pin.length < 4) {
        toast.error("Please enter your PIN (minimum 4 digits)");
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error("Please enter a valid amount");
        setLoading(false);
        return;
      }

      // Find source account to check balance
      const sourceAccount = accounts.find(
        (acc) => acc.id === formData.from_account_id,
      );
      if (
        sourceAccount &&
        parseFloat(formData.amount) > sourceAccount.balance
      ) {
        toast.error("Insufficient balance in source account");
        setLoading(false);
        return;
      }

     const payload = {
  amount: String(parseFloat(formData.amount).toFixed(2)), // "1222.00"
  currency: formData.currency,

  destination:
    formData.transfer_type === "internal"
      ? JSON.parse(localStorage.getItem("tenant_config") ?? '{}')?.tenant_id
      : formData.beneficiary_bank || "",

  from: {
    idType: "ACCOUNT_ID",
    idValue: formData.from_account_number,
    displayName: "Sender",
  },

  to: {
    idType: "ACCOUNT_ID",
    idValue:
      formData.transfer_type === "internal"
        ? formData.to_account_number
        : formData.to_account_number,

    displayName: formData.beneficiary_name || "Recipient",
  },

  note:
    (formData.narration || formData.description || "Transfer").trim(),

  pin: formData.pin,

  switch_name: "mojaloop",
};
      await apiClient.post("/payment-hub/api/v1/transfers/initiate", payload);

      toast.success("Transfer initiated successfully!");

      // Reset form
      setFormData({
        from_account_id: "",
        from_account_number: "",
        to_account_id: "",
        to_account_number: "",
        amount: "",
        currency: "NGN",
        transfer_type: "internal",
        description: "",
        beneficiary_name: "",
        beneficiary_bank: "",
        beneficiary_bank_code: "",
        narration: "",
        pin: "",
      });

      if (onSuccess) {
        onSuccess();
      }

      if (!standalone) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Transfer submission error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to submit transfer. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Transfer Type */}
      <div className="space-y-2">
        <Label htmlFor="transfer_type">Transfer Type</Label>
        <Select
          value={formData.transfer_type}
          onValueChange={(value) =>
            setFormData({ ...formData, transfer_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select transfer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">
              Internal Transfer (Same Bank)
            </SelectItem>
            <SelectItem value="external">
              External Transfer (Other Bank)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* From Account */}
      <div className="space-y-2">
        <Label>From Account *</Label>
        <Popover
          open={fromAccountComboOpen}
          onOpenChange={setFromAccountComboOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={fromAccountComboOpen}
              className="w-full justify-between"
            >
              {formData.from_account_id
                ? accounts.find((acc) => acc.id === formData.from_account_id)
                    ?.account_number +
                  " - " +
                  accounts.find((acc) => acc.id === formData.from_account_id)
                    ?.account_name
                : "Select source account..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search accounts..." />
              <CommandList>
                <CommandEmpty>
                  {accountsLoading
                    ? "Loading accounts..."
                    : "No accounts found."}
                </CommandEmpty>
                <CommandGroup>
                  {accounts.map((account) => (
                    <CommandItem
                      key={account.id}
                      value={
                        account.account_number + " " + account.account_name
                      }
                      onSelect={() => {
                        setFormData({
                          ...formData,
                          from_account_id: account.id,
                          from_account_number: account.account_number,
                        });
                        setFromAccountComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.from_account_id === account.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {account.account_number}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {account.account_name} ({account.account_type}) -{" "}
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* To Account - Internal */}
      {formData.transfer_type === "internal" && (
        <div className="space-y-2">
          <Label>To Account *</Label>
          <Popover
            open={toAccountComboOpen}
            onOpenChange={setToAccountComboOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={toAccountComboOpen}
                className="w-full justify-between"
              >
                {formData.to_account_id
                  ? accounts.find((acc) => acc.id === formData.to_account_id)
                      ?.account_number +
                    " - " +
                    accounts.find((acc) => acc.id === formData.to_account_id)
                      ?.account_name
                  : "Select destination account..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search accounts..." />
                <CommandList>
                  <CommandEmpty>
                    {accountsLoading
                      ? "Loading accounts..."
                      : "No accounts found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {accounts
                      .filter((acc) => acc.id !== formData.from_account_id)
                      .map((account) => (
                        <CommandItem
                          key={account.id}
                          value={
                            account.account_number + " " + account.account_name
                          }
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              to_account_id: account.id,
                              to_account_number: account.account_number,
                            });
                            setToAccountComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.to_account_id === account.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {account.account_number}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {account.account_name} ({account.account_type})
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* To Account - External */}
      {formData.transfer_type === "external" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="to_account_number">
              Beneficiary Account Number *
            </Label>
            <Input
              id="to_account_number"
              type="text"
              placeholder="Enter account number"
              value={formData.to_account_number}
              onChange={(e) =>
                setFormData({ ...formData, to_account_number: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beneficiary_name">Beneficiary Name</Label>
            <Input
              id="beneficiary_name"
              type="text"
              placeholder="Enter beneficiary name"
              value={formData.beneficiary_name}
              onChange={(e) =>
                setFormData({ ...formData, beneficiary_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="beneficiary_bank">Bank Name</Label>
              <Input
                id="beneficiary_bank"
                type="text"
                placeholder="Enter bank name"
                value={formData.beneficiary_bank}
                onChange={(e) =>
                  setFormData({ ...formData, beneficiary_bank: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="beneficiary_bank_code">Bank Code</Label>
              <Input
                id="beneficiary_bank_code"
                type="text"
                placeholder="Enter bank code"
                value={formData.beneficiary_bank_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    beneficiary_bank_code: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <div className="flex gap-2">
          <Select
            value={formData.currency}
            onValueChange={(value) =>
              setFormData({ ...formData, currency: value })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Enter amount"
            className="flex-1"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            required
          />
        </div>
      </div>

      {/* Narration */}
      <div className="space-y-2">
        <Label htmlFor="narration">Narration/Description</Label>
        <Textarea
          id="narration"
          placeholder="Enter transfer description"
          value={formData.narration}
          onChange={(e) =>
            setFormData({ ...formData, narration: e.target.value })
          }
          rows={3}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: "QR Payment", title: "Payment made via QR code scan" },
            { label: "Offline Transaction", title: "Transaction queued while device was offline" },
          ].map(({ label, title }) => {
            const active = formData.narration === label;
            return (
              <button
                key={label}
                type="button"
                title={title}
                onClick={() => setFormData({ ...formData, narration: active ? "" : label })}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  active
                    ? "text-white border-transparent"
                    : "text-muted-foreground hover:border-primary hover:text-primary"
                )}
                style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PIN */}
      <div className="space-y-2">
        <Label htmlFor="pin">Transaction PIN</Label>
        <Input
          id="pin"
          type="password"
          placeholder="Enter your PIN"
          value={formData.pin}
          onChange={(e) =>
            setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })
          }
          required
          minLength={4}
          maxLength={8}
          inputMode="numeric"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        {!standalone && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? "Processing..." : "Submit Transfer"}
        </Button>
      </div>
    </form>
  );

  if (standalone) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Transfer Funds</CardTitle>
          <CardDescription>
            Transfer money between accounts or to external beneficiaries
          </CardDescription>
        </CardHeader>
        <CardContent>{formContent}</CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Transfer money between accounts or to external beneficiaries
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
