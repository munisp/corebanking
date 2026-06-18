import { Check, ChevronsUpDown, Handshake } from "lucide-react";
import { BACKEND_URL } from "../const";
import React, { useEffect, useState } from "react";
import kybService from "../services/kybService";
import type { Business } from "../types/kyb";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "../components/ui/command";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../components/ui/popover";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import { cn } from "../lib/utils";
import apiClient from "../services/api";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  keycloakId?: string;
}

const LpoApplicationScreen: React.FC = () => {
  const { primaryColor } = useTenantBranding();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businessComboOpen, setBusinessComboOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [lpoNumber, setLpoNumber] = useState("");
  const [issuingOrganization, setIssuingOrganization] = useState("");
  const [lpoAmount, setLpoAmount] = useState("");
  const [financingAmount, setFinancingAmount] = useState("");
  const [repaymentDays, setRepaymentDays] = useState("");
  const [lpoDocumentUrl, setLpoDocumentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

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

    fetchUsers();
  }, []);

  useEffect(() => {
    setBusinessesLoading(true);
    kybService.getAllBusinesses()
      .then(setBusinesses)
      .catch(() => setBusinesses([]))
      .finally(() => setBusinessesLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/lpo/api/v1/lpo/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customerId,
            supplier_id: supplierId,
            lpo_number: lpoNumber,
            issuing_organization: issuingOrganization,
            lpo_amount: Number(lpoAmount),
            financing_amount: Number(financingAmount),
            repayment_days: Number(repaymentDays),
            lpo_document_url: lpoDocumentUrl,
          }),
        },
      );
      const data = await response.json();
      toast.success("LPO application submitted successfully");
      setResult(JSON.stringify(data));
    } catch (err) {
      toast.error("Error submitting LPO application");
      setResult("Error submitting LPO application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <Handshake className="w-8 h-8" style={{ color: primaryColor }} />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                LPO Application
              </h1>
              <p className="text-muted-foreground mt-1">
                Submit a new Local Purchase Order application
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 flex justify-center">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit} autoComplete="off">
            <CardHeader>
              <CardTitle>LPO Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label htmlFor="customer_id">Customer *</Label>
                <Popover
                  open={customerComboOpen}
                  onOpenChange={setCustomerComboOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerComboOpen}
                      className="w-full justify-between"
                      disabled={usersLoading}
                      type="button"
                    >
                      {customerId
                        ? users.find(
                            (user) =>
                              (user.keycloakId || user.id) === customerId,
                          )?.name
                        : usersLoading
                          ? "Loading customers..."
                          : "Select customer"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
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

              <div className="space-y-2">
                <Label>Business (Supplier) *</Label>
                <Popover open={businessComboOpen} onOpenChange={setBusinessComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={businessComboOpen}
                      className="w-full justify-between"
                      disabled={businessesLoading}
                      type="button"
                    >
                      {selectedBusiness
                        ? selectedBusiness.name
                        : businessesLoading
                          ? "Loading businesses..."
                          : "Select business"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search business..." />
                      <CommandList>
                        <CommandEmpty>No business found.</CommandEmpty>
                        <CommandGroup>
                          {businesses.map((b) => (
                            <CommandItem
                              key={b.id}
                              value={`${b.name} ${b.registration_number ?? ''}`}
                              onSelect={() => {
                                setSelectedBusiness(b);
                                setSupplierId(b.id);
                                setBusinessComboOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedBusiness?.id === b.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{b.name}</span>
                                {b.registration_number && (
                                  <span className="text-xs text-muted-foreground">Reg: {b.registration_number}</span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lpoNumber">LPO Number</Label>
                  <Input
                    id="lpoNumber"
                    type="text"
                    value={lpoNumber}
                    onChange={(e) => setLpoNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="issuingOrganization">
                    Issuing Organization
                  </Label>
                  <Input
                    id="issuingOrganization"
                    type="text"
                    value={issuingOrganization}
                    onChange={(e) => setIssuingOrganization(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lpoAmount">LPO Amount</Label>
                  <Input
                    id="lpoAmount"
                    type="number"
                    value={lpoAmount}
                    onChange={(e) => setLpoAmount(e.target.value)}
                    required
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="financingAmount">Financing Amount</Label>
                  <Input
                    id="financingAmount"
                    type="number"
                    value={financingAmount}
                    onChange={(e) => setFinancingAmount(e.target.value)}
                    required
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="repaymentDays">Repayment Days</Label>
                  <Input
                    id="repaymentDays"
                    type="number"
                    value={repaymentDays}
                    onChange={(e) => setRepaymentDays(e.target.value)}
                    required
                    min={0}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="lpoDocumentUrl">LPO Document URL</Label>
                  <Input
                    id="lpoDocumentUrl"
                    type="text"
                    value={lpoDocumentUrl}
                    onChange={(e) => setLpoDocumentUrl(e.target.value)}
                  />
                </div>
              </div>
              {result && (
                <div className="bg-muted rounded p-2 text-xs mt-2">
                  <strong>Result:</strong>
                  <pre className="whitespace-pre-wrap break-all">{result}</pre>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full text-white"
                disabled={loading}
                style={{ backgroundColor: loading ? undefined : primaryColor }}
              >
                {loading ? "Submitting..." : "Apply"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LpoApplicationScreen;
