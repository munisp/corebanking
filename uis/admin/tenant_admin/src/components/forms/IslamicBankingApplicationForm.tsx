import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { cn } from "@/lib/utils";
import apiClient from "@/services/api";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  keycloakId?: string;
}

interface IslamicBankingApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultProductType?: string;
  standalone?: boolean;
}

export default function IslamicBankingApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  defaultProductType = "murabaha",
  standalone = false,
}: IslamicBankingApplicationFormProps) {
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultProductType);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Murabaha form state
  const [murabahaData, setMurabahaData] = useState({
    asset_name: "",
    cost_price: "",
    profit_margin: "",
    tenure_months: "",
  });

  // Musharaka form state
  const [musharakaData, setMusharakaData] = useState({
    business_name: "",
    customer_contribution: "",
    bank_contribution: "",
    customer_profit_share: "",
  });

  // Ijara form state
  const [ijaraData, setIjaraData] = useState({
    asset_name: "",
    asset_value: "",
    tenure_months: "",
    lease_type: "operating",
  });

  // Takaful form state
  const [takafulData, setTakafulData] = useState({
    policy_type: "family",
    policy_name: "",
    coverage_amount: "",
    frequency: "monthly",
  });

  // Sukuk form state
  const [sukukData, setSukukData] = useState({
    sukuk_type: "ijara",
    sukuk_name: "",
    investment_amount: "",
    tenure_months: "",
  });

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await apiClient.get("/user/user/tenant");
        const data = response.data;

        let usersData: any[] = [];
        if (Array.isArray(data)) {
          usersData = data;
        } else if (Array.isArray(data.users)) {
          usersData = data.users;
        } else if (Array.isArray(data.data)) {
          usersData = data.data;
        }

        const mappedUsers: User[] = usersData.map((user: any) => ({
          id: user.id || user.user_id,
          name:
            user.name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Unknown User",
          email: user.email || "",
          phone: user.phone_number || user.phone || "",
          keycloakId: user.keycloak_id || user.keycloakId || user.id,
        }));

        setUsers(mappedUsers);
      } catch (error: any) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users");
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  const handleMurabahaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/islamic-banking/api/v1/murabaha", {
        customer_id: customerId,
        asset_name: murabahaData.asset_name,
        cost_price: Number(murabahaData.cost_price),
        profit_margin: Number(murabahaData.profit_margin),
        tenure_months: Number(murabahaData.tenure_months),
      });

      toast.success("Murabaha application submitted successfully");
      setMurabahaData({
        asset_name: "",
        cost_price: "",
        profit_margin: "",
        tenure_months: "",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit Murabaha application",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMusharakaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/islamic-banking/api/v1/musharaka", {
        customer_id: customerId,
        business_name: musharakaData.business_name,
        customer_contribution: Number(musharakaData.customer_contribution),
        bank_contribution: Number(musharakaData.bank_contribution),
        customer_profit_share: Number(musharakaData.customer_profit_share),
      });

      toast.success("Musharaka application submitted successfully");
      setMusharakaData({
        business_name: "",
        customer_contribution: "",
        bank_contribution: "",
        customer_profit_share: "",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit Musharaka application",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleIjaraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/islamic-banking/api/v1/ijara", {
        customer_id: customerId,
        asset_name: ijaraData.asset_name,
        asset_value: Number(ijaraData.asset_value),
        tenure_months: Number(ijaraData.tenure_months),
        lease_type: ijaraData.lease_type,
      });

      toast.success("Ijara application submitted successfully");
      setIjaraData({
        asset_name: "",
        asset_value: "",
        tenure_months: "",
        lease_type: "operating",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to submit Ijara application",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTakafulSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/islamic-banking/api/v1/takaful", {
        customer_id: customerId,
        policy_type: takafulData.policy_type,
        policy_name: takafulData.policy_name,
        coverage_amount: Number(takafulData.coverage_amount),
        frequency: takafulData.frequency,
      });

      toast.success("Takaful application submitted successfully");
      setTakafulData({
        policy_type: "family",
        policy_name: "",
        coverage_amount: "",
        frequency: "monthly",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit Takaful application",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSukukSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/islamic-banking/api/v1/sukuk", {
        customer_id: customerId,
        sukuk_type: sukukData.sukuk_type,
        sukuk_name: sukukData.sukuk_name,
        investment_amount: Number(sukukData.investment_amount),
        tenure_months: Number(sukukData.tenure_months),
      });

      toast.success("Sukuk investment submitted successfully");
      setSukukData({
        sukuk_type: "ijara",
        sukuk_name: "",
        investment_amount: "",
        tenure_months: "",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to submit Sukuk investment",
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <>
      {!standalone && (
        <DialogHeader>
          <DialogTitle>Islamic Banking Application</DialogTitle>
          <DialogDescription>
            Submit an application for Islamic banking products
          </DialogDescription>
        </DialogHeader>
      )}

      {/* Customer Selection - Always visible */}
      <div className="space-y-2 py-4">
        <Label htmlFor="customer_id">Customer *</Label>
        <Popover open={customerComboOpen} onOpenChange={setCustomerComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={customerComboOpen}
              className="w-full justify-between"
              disabled={usersLoading}
            >
              {customerId
                ? users.find(
                    (user) => (user.keycloakId || user.id) === customerId,
                  )?.name
                : usersLoading
                  ? "Loading customers..."
                  : "Select customer"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search customers..." />
              <CommandList>
                <CommandEmpty>No customer found.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.keycloakId || user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => {
                        const userId = user.keycloakId || user.id;
                        setCustomerId(userId);
                        setCustomerName(user.name);
                        setCustomerComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          customerId === (user.keycloakId || user.id)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        {user.email && (
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={standalone ? "space-y-6" : ""}
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="murabaha">Murabaha</TabsTrigger>
          <TabsTrigger value="musharaka">Musharaka</TabsTrigger>
          <TabsTrigger value="ijara">Ijara</TabsTrigger>
          <TabsTrigger value="takaful">Takaful</TabsTrigger>
          <TabsTrigger value="sukuk">Sukuk</TabsTrigger>
        </TabsList>

        {/* Murabaha Form */}
        <TabsContent value="murabaha">
          <form onSubmit={handleMurabahaSubmit}>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Cost-plus financing for purchasing assets
              </p>
              <div className="space-y-2">
                <Label htmlFor="murabaha_asset_name">Asset Name</Label>
                <Input
                  id="murabaha_asset_name"
                  type="text"
                  value={murabahaData.asset_name}
                  onChange={(e) =>
                    setMurabahaData({
                      ...murabahaData,
                      asset_name: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g., Toyota Camry 2024"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="murabaha_cost_price">Cost Price</Label>
                <Input
                  id="murabaha_cost_price"
                  type="number"
                  value={murabahaData.cost_price}
                  onChange={(e) =>
                    setMurabahaData({
                      ...murabahaData,
                      cost_price: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter cost price"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="murabaha_profit_margin">
                  Profit Margin (%)
                </Label>
                <Input
                  id="murabaha_profit_margin"
                  type="number"
                  value={murabahaData.profit_margin}
                  onChange={(e) =>
                    setMurabahaData({
                      ...murabahaData,
                      profit_margin: e.target.value,
                    })
                  }
                  required
                  min={0}
                  step={0.1}
                  placeholder="e.g., 10.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="murabaha_tenure_months">Tenure (Months)</Label>
                <Input
                  id="murabaha_tenure_months"
                  type="number"
                  value={murabahaData.tenure_months}
                  onChange={(e) =>
                    setMurabahaData({
                      ...murabahaData,
                      tenure_months: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="e.g., 24"
                />
              </div>
            </div>

            {!standalone && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            )}
            {standalone && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>

        {/* Musharaka Form */}
        <TabsContent value="musharaka">
          <form onSubmit={handleMusharakaSubmit}>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Partnership financing for business ventures
              </p>
              <div className="space-y-2">
                <Label htmlFor="musharaka_business_name">Business Name</Label>
                <Input
                  id="musharaka_business_name"
                  type="text"
                  value={musharakaData.business_name}
                  onChange={(e) =>
                    setMusharakaData({
                      ...musharakaData,
                      business_name: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g., Tech Solutions Ltd"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="musharaka_customer_contribution">
                  Customer Contribution
                </Label>
                <Input
                  id="musharaka_customer_contribution"
                  type="number"
                  value={musharakaData.customer_contribution}
                  onChange={(e) =>
                    setMusharakaData({
                      ...musharakaData,
                      customer_contribution: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter customer contribution"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="musharaka_bank_contribution">
                  Bank Contribution
                </Label>
                <Input
                  id="musharaka_bank_contribution"
                  type="number"
                  value={musharakaData.bank_contribution}
                  onChange={(e) =>
                    setMusharakaData({
                      ...musharakaData,
                      bank_contribution: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter bank contribution"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="musharaka_customer_profit_share">
                  Customer Profit Share (%)
                </Label>
                <Input
                  id="musharaka_customer_profit_share"
                  type="number"
                  value={musharakaData.customer_profit_share}
                  onChange={(e) =>
                    setMusharakaData({
                      ...musharakaData,
                      customer_profit_share: e.target.value,
                    })
                  }
                  required
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="e.g., 40.0"
                />
              </div>
            </div>

            {!standalone && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Partnership"}
                </Button>
              </DialogFooter>
            )}
            {standalone && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Partnership"}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>

        {/* Ijara Form */}
        <TabsContent value="ijara">
          <form onSubmit={handleIjaraSubmit}>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Islamic leasing for assets and equipment
              </p>
              <div className="space-y-2">
                <Label htmlFor="ijara_asset_name">Asset Name</Label>
                <Input
                  id="ijara_asset_name"
                  type="text"
                  value={ijaraData.asset_name}
                  onChange={(e) =>
                    setIjaraData({ ...ijaraData, asset_name: e.target.value })
                  }
                  required
                  placeholder="e.g., Office Equipment"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ijara_asset_value">Asset Value</Label>
                <Input
                  id="ijara_asset_value"
                  type="number"
                  value={ijaraData.asset_value}
                  onChange={(e) =>
                    setIjaraData({
                      ...ijaraData,
                      asset_value: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter asset value"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ijara_tenure_months">Tenure (Months)</Label>
                <Input
                  id="ijara_tenure_months"
                  type="number"
                  value={ijaraData.tenure_months}
                  onChange={(e) =>
                    setIjaraData({
                      ...ijaraData,
                      tenure_months: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="e.g., 18"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ijara_lease_type">Lease Type</Label>
                <Select
                  value={ijaraData.lease_type}
                  onValueChange={(value) =>
                    setIjaraData({ ...ijaraData, lease_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operating">Operating Lease</SelectItem>
                    <SelectItem value="finance">Finance Lease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!standalone && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Lease"}
                </Button>
              </DialogFooter>
            )}
            {standalone && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Lease"}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>

        {/* Takaful Form */}
        <TabsContent value="takaful">
          <form onSubmit={handleTakafulSubmit}>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Islamic insurance for protection and coverage
              </p>
              <div className="space-y-2">
                <Label htmlFor="takaful_policy_type">Policy Type</Label>
                <Select
                  value={takafulData.policy_type}
                  onValueChange={(value) =>
                    setTakafulData({ ...takafulData, policy_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family Protection</SelectItem>
                    <SelectItem value="health">Health Coverage</SelectItem>
                    <SelectItem value="property">
                      Property Protection
                    </SelectItem>
                    <SelectItem value="motor">Motor Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="takaful_policy_name">Policy Name</Label>
                <Input
                  id="takaful_policy_name"
                  type="text"
                  value={takafulData.policy_name}
                  onChange={(e) =>
                    setTakafulData({
                      ...takafulData,
                      policy_name: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g., Family Protection Plan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="takaful_coverage_amount">Coverage Amount</Label>
                <Input
                  id="takaful_coverage_amount"
                  type="number"
                  value={takafulData.coverage_amount}
                  onChange={(e) =>
                    setTakafulData({
                      ...takafulData,
                      coverage_amount: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter coverage amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="takaful_frequency">Payment Frequency</Label>
                <Select
                  value={takafulData.frequency}
                  onValueChange={(value) =>
                    setTakafulData({ ...takafulData, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!standalone && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </DialogFooter>
            )}
            {standalone && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>

        {/* Sukuk Form */}
        <TabsContent value="sukuk">
          <form onSubmit={handleSukukSubmit}>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Islamic bonds for investment
              </p>
              <div className="space-y-2">
                <Label htmlFor="sukuk_sukuk_type">Sukuk Type</Label>
                <Select
                  value={sukukData.sukuk_type}
                  onValueChange={(value) =>
                    setSukukData({ ...sukukData, sukuk_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ijara">Ijara Sukuk</SelectItem>
                    <SelectItem value="murabaha">Murabaha Sukuk</SelectItem>
                    <SelectItem value="musharaka">Musharaka Sukuk</SelectItem>
                    <SelectItem value="salam">Salam Sukuk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sukuk_sukuk_name">Sukuk Name</Label>
                <Input
                  id="sukuk_sukuk_name"
                  type="text"
                  value={sukukData.sukuk_name}
                  onChange={(e) =>
                    setSukukData({ ...sukukData, sukuk_name: e.target.value })
                  }
                  required
                  placeholder="e.g., Real Estate Sukuk 2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sukuk_investment_amount">
                  Investment Amount
                </Label>
                <Input
                  id="sukuk_investment_amount"
                  type="number"
                  value={sukukData.investment_amount}
                  onChange={(e) =>
                    setSukukData({
                      ...sukukData,
                      investment_amount: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="Enter investment amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sukuk_tenure_months">Tenure (Months)</Label>
                <Input
                  id="sukuk_tenure_months"
                  type="number"
                  value={sukukData.tenure_months}
                  onChange={(e) =>
                    setSukukData({
                      ...sukukData,
                      tenure_months: e.target.value,
                    })
                  }
                  required
                  min={1}
                  placeholder="e.g., 36"
                />
              </div>
            </div>

            {!standalone && (
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Investment"}
                </Button>
              </DialogFooter>
            )}
            {standalone && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-white"
                  style={{
                    backgroundColor: loading ? undefined : primaryColor,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Investment"}
                </Button>
              </div>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </>
  );

  if (standalone) {
    return (
      <div className="max-w-4xl mx-auto bg-card rounded-lg border p-6">
        {formContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
