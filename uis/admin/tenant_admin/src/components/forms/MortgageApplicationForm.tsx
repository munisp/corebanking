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

interface MortgageApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  standalone?: boolean;
}

export default function MortgageApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  standalone = false,
}: MortgageApplicationFormProps) {
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [applicantComboOpen, setApplicantComboOpen] = useState(false);

  const [formData, setFormData] = useState({
    product_type: "conventional",
    primary_applicant_id: "",
    primary_applicant_name: "",
    requested_amount: "",
    requested_tenor_months: "",
    down_payment: "",
    employment_type: "employed",
    monthly_gross_income: "",
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
      await apiClient.post("/mortgage/api/v1/mortgages/applications", {
        product_type: formData.product_type,
        primary_applicant_id: formData.primary_applicant_id,
        primary_applicant_name: formData.primary_applicant_name,
        requested_amount: Number(formData.requested_amount),
        requested_tenor_months: Number(formData.requested_tenor_months),
        down_payment: Number(formData.down_payment),
        employment_type: formData.employment_type,
        monthly_gross_income: Number(formData.monthly_gross_income),
      });

      toast.success("Mortgage application submitted successfully");
      setFormData({
        product_type: "conventional",
        primary_applicant_id: "",
        primary_applicant_name: "",
        requested_amount: "",
        requested_tenor_months: "",
        down_payment: "",
        employment_type: "employed",
        monthly_gross_income: "",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit mortgage application",
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className={standalone ? "space-y-6" : ""}>
      {!standalone && (
        <DialogHeader>
          <DialogTitle>Mortgage Application</DialogTitle>
          <DialogDescription>
            Submit a new mortgage application
          </DialogDescription>
        </DialogHeader>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="product_type">Product Type</Label>
          <Select
            value={formData.product_type}
            onValueChange={(value) =>
              setFormData({ ...formData, product_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conventional">Conventional</SelectItem>
              <SelectItem value="nhf">NHF (National Housing Fund)</SelectItem>
              <SelectItem value="rent_to_own">Rent to Own</SelectItem>
              <SelectItem value="off_plan">Off Plan</SelectItem>
              <SelectItem value="equity_release">Equity Release</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_applicant_id">Applicant *</Label>
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
                {formData.primary_applicant_id
                  ? users.find(
                      (user) =>
                        (user.keycloakId || user.id) ===
                        formData.primary_applicant_id,
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
                            primary_applicant_id: userId,
                            primary_applicant_name: user.name,
                          });
                          setApplicantComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.primary_applicant_id ===
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
          <Label htmlFor="primary_applicant_name">Applicant Name</Label>
          <Input
            id="primary_applicant_name"
            type="text"
            value={formData.primary_applicant_name}
            onChange={(e) =>
              setFormData({
                ...formData,
                primary_applicant_name: e.target.value,
              })
            }
            required
            placeholder="Enter applicant name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requested_amount">Requested Amount</Label>
          <Input
            id="requested_amount"
            type="number"
            value={formData.requested_amount}
            onChange={(e) =>
              setFormData({ ...formData, requested_amount: e.target.value })
            }
            required
            min={1}
            placeholder="Enter requested amount"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requested_tenor_months">
            Tenor (Months, Max 360)
          </Label>
          <Input
            id="requested_tenor_months"
            type="number"
            value={formData.requested_tenor_months}
            onChange={(e) =>
              setFormData({
                ...formData,
                requested_tenor_months: e.target.value,
              })
            }
            required
            min={12}
            max={360}
            placeholder="e.g., 240"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="down_payment">Down Payment</Label>
          <Input
            id="down_payment"
            type="number"
            value={formData.down_payment}
            onChange={(e) =>
              setFormData({ ...formData, down_payment: e.target.value })
            }
            required
            min={0}
            placeholder="Enter down payment"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment_type">Employment Type</Label>
          <Select
            value={formData.employment_type}
            onValueChange={(value) =>
              setFormData({ ...formData, employment_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employed">Employed</SelectItem>
              <SelectItem value="self-employed">Self-Employed</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="business_owner">Business Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_gross_income">Monthly Gross Income</Label>
          <Input
            id="monthly_gross_income"
            type="number"
            value={formData.monthly_gross_income}
            onChange={(e) =>
              setFormData({
                ...formData,
                monthly_gross_income: e.target.value,
              })
            }
            required
            min={0}
            placeholder="Enter monthly gross income"
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
