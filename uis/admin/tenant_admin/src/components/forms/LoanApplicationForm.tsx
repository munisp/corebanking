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

interface LoanApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  standalone?: boolean;
}

export default function LoanApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  standalone = false,
}: LoanApplicationFormProps) {
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [applicantComboOpen, setApplicantComboOpen] = useState(false);

  const [formData, setFormData] = useState({
    applicant_id: "",
    applicant_name: "",
    loan_amount: "",
    loan_purpose: "",
    requested_term: "",
    monthly_income: "",
    existing_debt: "",
    collateral_value: "",
    credit_score: "",
    employment_status: "employed",
    employment_duration: "",
    bank_statement_score: "",
    bvn_verified: false,
    nin_verified: false,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post("/loan/api/v1/loans/applications", {
        applicant_id: formData.applicant_id,
        loan_amount: Number(formData.loan_amount),
        loan_purpose: formData.loan_purpose,
        requested_term: Number(formData.requested_term),
        monthly_income: Number(formData.monthly_income),
        existing_debt: Number(formData.existing_debt),
        collateral_value: Number(formData.collateral_value),
        credit_score: Number(formData.credit_score),
        employment_status: formData.employment_status,
        employment_duration: Number(formData.employment_duration),
        bank_statement_score: Number(formData.bank_statement_score),
        bvn_verified: formData.bvn_verified,
        nin_verified: formData.nin_verified,
      });

      toast.success("Loan application submitted successfully");
      setFormData({
        applicant_id: "",
        applicant_name: "",
        loan_amount: "",
        loan_purpose: "",
        requested_term: "",
        monthly_income: "",
        existing_debt: "",
        collateral_value: "",
        credit_score: "",
        employment_status: "employed",
        employment_duration: "",
        bank_statement_score: "",
        bvn_verified: false,
        nin_verified: false,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to submit loan application",
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className={standalone ? "space-y-6" : ""}>
      {!standalone && (
        <DialogHeader>
          <DialogTitle>Loan Application</DialogTitle>
          <DialogDescription>Submit a new loan application</DialogDescription>
        </DialogHeader>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="applicant_id">Applicant *</Label>
          <Popover
            open={applicantComboOpen}
            onOpenChange={setApplicantComboOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={applicantComboOpen}
                className="w-full justify-between"
                disabled={usersLoading}
              >
                {formData.applicant_id
                  ? users.find(
                      (user) =>
                        (user.keycloakId || user.id) === formData.applicant_id,
                    )?.name
                  : usersLoading
                    ? "Loading applicants..."
                    : "Select applicant"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search applicants..." />
                <CommandList>
                  <CommandEmpty>No applicant found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem
                        key={user.keycloakId || user.id}
                        value={`${user.name} ${user.email}`}
                        onSelect={() => {
                          const userId = user.keycloakId || user.id;
                          setFormData({
                            ...formData,
                            applicant_id: userId,
                            applicant_name: user.name,
                          });
                          setApplicantComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.applicant_id ===
                              (user.keycloakId || user.id)
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

        <div className="space-y-2">
          <Label htmlFor="loan_amount">Loan Amount *</Label>
          <Input
            id="loan_amount"
            type="number"
            value={formData.loan_amount}
            onChange={(e) =>
              setFormData({ ...formData, loan_amount: e.target.value })
            }
            required
            min={1}
            placeholder="Enter loan amount"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="loan_purpose">Loan Purpose</Label>
          <Input
            id="loan_purpose"
            type="text"
            value={formData.loan_purpose}
            onChange={(e) =>
              setFormData({ ...formData, loan_purpose: e.target.value })
            }
            required
            maxLength={100}
            placeholder="e.g., Business expansion"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requested_term">Requested Term (months)</Label>
          <Input
            id="requested_term"
            type="number"
            value={formData.requested_term}
            onChange={(e) =>
              setFormData({ ...formData, requested_term: e.target.value })
            }
            required
            min={1}
            placeholder="e.g., 12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_income">Monthly Income</Label>
          <Input
            id="monthly_income"
            type="number"
            value={formData.monthly_income}
            onChange={(e) =>
              setFormData({ ...formData, monthly_income: e.target.value })
            }
            required
            min={0}
            placeholder="Enter monthly income"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="existing_debt">Existing Debt</Label>
          <Input
            id="existing_debt"
            type="number"
            value={formData.existing_debt}
            onChange={(e) =>
              setFormData({ ...formData, existing_debt: e.target.value })
            }
            required
            min={0}
            placeholder="Enter existing debt"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="collateral_value">Collateral Value</Label>
          <Input
            id="collateral_value"
            type="number"
            value={formData.collateral_value}
            onChange={(e) =>
              setFormData({
                ...formData,
                collateral_value: e.target.value,
              })
            }
            required
            min={0}
            placeholder="Enter collateral value"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="credit_score">Credit Score</Label>
          <Input
            id="credit_score"
            type="number"
            value={formData.credit_score}
            onChange={(e) =>
              setFormData({ ...formData, credit_score: e.target.value })
            }
            required
            min={0}
            max={850}
            placeholder="Enter credit score"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment_status">Employment Status</Label>
          <Select
            value={formData.employment_status}
            onValueChange={(value) =>
              setFormData({ ...formData, employment_status: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employed">Employed</SelectItem>
              <SelectItem value="self-employed">Self-Employed</SelectItem>
              <SelectItem value="unemployed">Unemployed</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment_duration">
            Employment Duration (months)
          </Label>
          <Input
            id="employment_duration"
            type="number"
            value={formData.employment_duration}
            onChange={(e) =>
              setFormData({
                ...formData,
                employment_duration: e.target.value,
              })
            }
            required
            min={0}
            placeholder="Enter employment duration"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank_statement_score">Bank Statement Score</Label>
          <Input
            id="bank_statement_score"
            type="number"
            value={formData.bank_statement_score}
            onChange={(e) =>
              setFormData({
                ...formData,
                bank_statement_score: e.target.value,
              })
            }
            required
            min={0}
            max={100}
            placeholder="Enter bank statement score"
          />
        </div>

        <div className="space-y-2 flex items-center gap-2">
          <input
            id="bvn_verified"
            type="checkbox"
            checked={formData.bvn_verified}
            onChange={(e) =>
              setFormData({ ...formData, bvn_verified: e.target.checked })
            }
            className="h-4 w-4"
          />
          <Label htmlFor="bvn_verified" className="cursor-pointer">
            BVN Verified
          </Label>
        </div>

        <div className="space-y-2 flex items-center gap-2">
          <input
            id="nin_verified"
            type="checkbox"
            checked={formData.nin_verified}
            onChange={(e) =>
              setFormData({ ...formData, nin_verified: e.target.checked })
            }
            className="h-4 w-4"
          />
          <Label htmlFor="nin_verified" className="cursor-pointer">
            NIN Verified
          </Label>
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
            style={{ backgroundColor: loading ? undefined : primaryColor }}
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
            style={{ backgroundColor: loading ? undefined : primaryColor }}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      )}
    </form>
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
