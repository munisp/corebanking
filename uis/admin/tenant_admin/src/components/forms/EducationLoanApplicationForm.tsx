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

interface EducationLoanApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  standalone?: boolean;
}

export default function EducationLoanApplicationForm({
  open,
  onOpenChange,
  onSuccess,
  standalone = false,
}: EducationLoanApplicationFormProps) {
  const { primaryColor } = useTenantBranding();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [studentComboOpen, setStudentComboOpen] = useState(false);

  const [formData, setFormData] = useState({
    student_id: "",
    student_name: "",
    student_bvn: "",
    student_nin: "",
    student_email: "",
    student_phone: "",
    loan_type: "undergraduate",
    institution_id: "",
    program_name: "",
    program_duration_years: "",
    current_year: "1",
    tuition_fee_per_year: "",
    accommodation_per_year: "",
    requested_amount: "",
    repayment_type: "deferred",
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
      await apiClient.post("/education-loan/applications", {
        student_id: formData.student_id,
        student_name: formData.student_name,
        student_bvn: formData.student_bvn,
        student_nin: formData.student_nin,
        student_email: formData.student_email,
        student_phone: formData.student_phone,
        loan_type: formData.loan_type,
        institution_id: formData.institution_id,
        program_name: formData.program_name,
        program_duration_years: Number(formData.program_duration_years),
        current_year: Number(formData.current_year),
        tuition_fee_per_year: Number(formData.tuition_fee_per_year),
        accommodation_per_year: Number(formData.accommodation_per_year),
        requested_amount: Number(formData.requested_amount),
        repayment_type: formData.repayment_type,
      });

      toast.success("Education loan application submitted successfully");
      setFormData({
        student_id: "",
        student_name: "",
        student_bvn: "",
        student_nin: "",
        student_email: "",
        student_phone: "",
        loan_type: "undergraduate",
        institution_id: "",
        program_name: "",
        program_duration_years: "",
        current_year: "1",
        tuition_fee_per_year: "",
        accommodation_per_year: "",
        requested_amount: "",
        repayment_type: "deferred",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit education loan application",
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className={standalone ? "space-y-6" : ""}>
      {!standalone && (
        <DialogHeader>
          <DialogTitle>Education Loan Application</DialogTitle>
          <DialogDescription>
            Submit a new education loan application
          </DialogDescription>
        </DialogHeader>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="student_id">Student *</Label>
          <Popover open={studentComboOpen} onOpenChange={setStudentComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={studentComboOpen}
                className="w-full justify-between"
                disabled={usersLoading}
              >
                {formData.student_id
                  ? users.find(
                      (user) =>
                        (user.keycloakId || user.id) === formData.student_id,
                    )?.name
                  : usersLoading
                    ? "Loading students..."
                    : "Select student"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search students..." />
                <CommandList>
                  <CommandEmpty>No student found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem
                        key={user.keycloakId || user.id}
                        value={`${user.name} ${user.email}`}
                        onSelect={() => {
                          const userId = user.keycloakId || user.id;
                          setFormData({
                            ...formData,
                            student_id: userId,
                            student_name: user.name,
                            student_email: user.email,
                            student_phone: user.phone || "",
                          });
                          setStudentComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.student_id === (user.keycloakId || user.id)
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
          <Label htmlFor="student_name">Student Name</Label>
          <Input
            id="student_name"
            type="text"
            value={formData.student_name}
            onChange={(e) =>
              setFormData({ ...formData, student_name: e.target.value })
            }
            required
            placeholder="Enter student name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student_email">Student Email</Label>
          <Input
            id="student_email"
            type="email"
            value={formData.student_email}
            onChange={(e) =>
              setFormData({ ...formData, student_email: e.target.value })
            }
            required
            placeholder="student@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student_phone">Student Phone</Label>
          <Input
            id="student_phone"
            type="tel"
            value={formData.student_phone}
            onChange={(e) =>
              setFormData({ ...formData, student_phone: e.target.value })
            }
            required
            placeholder="Enter phone number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student_bvn">BVN (Optional)</Label>
          <Input
            id="student_bvn"
            type="text"
            value={formData.student_bvn}
            onChange={(e) =>
              setFormData({ ...formData, student_bvn: e.target.value })
            }
            placeholder="Enter BVN"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student_nin">NIN (Optional)</Label>
          <Input
            id="student_nin"
            type="text"
            value={formData.student_nin}
            onChange={(e) =>
              setFormData({ ...formData, student_nin: e.target.value })
            }
            placeholder="Enter NIN"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="loan_type">Loan Type</Label>
          <Select
            value={formData.loan_type}
            onValueChange={(value) =>
              setFormData({ ...formData, loan_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="undergraduate">Undergraduate</SelectItem>
              <SelectItem value="postgraduate">Postgraduate</SelectItem>
              <SelectItem value="masters">Masters</SelectItem>
              <SelectItem value="phd">PhD</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="vocational">Vocational</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution_id">Institution ID</Label>
          <Input
            id="institution_id"
            type="text"
            value={formData.institution_id}
            onChange={(e) =>
              setFormData({ ...formData, institution_id: e.target.value })
            }
            required
            placeholder="Enter institution ID"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="program_name">Program Name</Label>
          <Input
            id="program_name"
            type="text"
            value={formData.program_name}
            onChange={(e) =>
              setFormData({ ...formData, program_name: e.target.value })
            }
            required
            placeholder="e.g., Computer Science"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="program_duration_years">
            Program Duration (Years)
          </Label>
          <Input
            id="program_duration_years"
            type="number"
            value={formData.program_duration_years}
            onChange={(e) =>
              setFormData({
                ...formData,
                program_duration_years: e.target.value,
              })
            }
            required
            min={1}
            max={10}
            placeholder="e.g., 4"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_year">Current Year</Label>
          <Input
            id="current_year"
            type="number"
            value={formData.current_year}
            onChange={(e) =>
              setFormData({ ...formData, current_year: e.target.value })
            }
            required
            min={1}
            placeholder="e.g., 1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tuition_fee_per_year">Tuition Fee Per Year</Label>
          <Input
            id="tuition_fee_per_year"
            type="number"
            value={formData.tuition_fee_per_year}
            onChange={(e) =>
              setFormData({
                ...formData,
                tuition_fee_per_year: e.target.value,
              })
            }
            required
            min={0}
            placeholder="Enter tuition fee"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accommodation_per_year">Accommodation Per Year</Label>
          <Input
            id="accommodation_per_year"
            type="number"
            value={formData.accommodation_per_year}
            onChange={(e) =>
              setFormData({
                ...formData,
                accommodation_per_year: e.target.value,
              })
            }
            min={0}
            placeholder="Enter accommodation cost"
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
          <Label htmlFor="repayment_type">Repayment Type</Label>
          <Select
            value={formData.repayment_type}
            onValueChange={(value) =>
              setFormData({ ...formData, repayment_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deferred">
                Deferred (After Graduation)
              </SelectItem>
              <SelectItem value="standard">Standard (During Study)</SelectItem>
              <SelectItem value="income_based">Income Based</SelectItem>
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
