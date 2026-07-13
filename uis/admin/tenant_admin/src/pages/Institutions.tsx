import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "../components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Table, TableBody, TableHeader } from "../components/ui/table";
import PageHeader from "../components/PageHeader";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import { cn } from "../lib/utils";
import {
    addInstitution,
    getInstitutions,
    getNucAccreditedInstitutions,
} from "../services/institutions";

interface Institution {
  id: string;
  name: string;
  type: string;
  nuc_accredited: boolean;
  accreditation_number: string;
  country: string;
  state: string;
  city: string;
  address: string;
  bank_account_number: string;
  bank_name: string;
  bank_code: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  verification_status: string;
  year_of_establishment?: string;
}

const initialPayload: Institution = {
  id: "",
  name: "",
  type: "",
  nuc_accredited: false,
  accreditation_number: "",
  country: "Nigeria",
  state: "",
  city: "",
  address: "",
  bank_account_number: "",
  bank_name: "",
  bank_code: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  verification_status: "pending",
};

export default function Institutions() {
  const [form, setForm] = useState<Institution>(initialPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [nucInstitutions, setNucInstitutions] = useState<Institution[]>([]);
  const [loadingNuc, setLoadingNuc] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedInstitution, setSelectedInstitution] =
    useState<Institution | null>(null);
  const { primaryColor } = useTenantBranding();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    let checked = false;
    if (type === "checkbox" && "checked" in e.target) {
      checked = (e.target as HTMLInputElement).checked;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await addInstitution(form);
      setIsAddDialogOpen(false);
      setForm(initialPayload);
      fetchAll();
    } catch (err) {
      let msg = "Failed to add institution";
      if (err && typeof err === "object") {
        if (
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "data" in err.response &&
          err.response.data &&
          typeof err.response.data === "object" &&
          "message" in err.response.data
        ) {
          msg = (err.response.data as { message?: string }).message || msg;
        } else if ("message" in err) {
          msg = (err as { message?: string }).message || msg;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async (page = currentPage, size = pageSize) => {
    setFetching(true);
    setError("");
    try {
      const data = await getInstitutions({ page, limit: size });
      setInstitutions(data.institutions || data.data || []);
      setTotal(data.total ?? (data.institutions || data.data || []).length);
    } catch (err) {
      let msg = "Failed to fetch institutions";
      if (err && typeof err === "object") {
        if (
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "data" in err.response &&
          err.response.data &&
          typeof err.response.data === "object" &&
          "message" in err.response.data
        ) {
          msg = (err.response.data as { message?: string }).message || msg;
        } else if ("message" in err) {
          msg = (err as { message?: string }).message || msg;
        }
      }
      setError(msg);
    } finally {
      setFetching(false);
    }
  };

  const fetchNucInstitutions = async () => {
    setLoadingNuc(true);
    try {
      const response = await getNucAccreditedInstitutions();
      // Response structure: { institutions: [...] }
      setNucInstitutions(response.institutions || []);
    } catch (err) {
      console.error("Failed to fetch NUC institutions:", err);
      setNucInstitutions([]);
    } finally {
      setLoadingNuc(false);
    }
  };

  const handleSelectInstitution = (institution: Institution) => {
    setSelectedInstitution(institution);
    // Auto-fill the form with selected institution data
    setForm((prev) => ({
      ...prev,
      name: institution.name || "",
      type: institution.type?.toLowerCase() || prev.type,
      nuc_accredited: true,
      state: prev.state,
      city: prev.city,
      address: prev.address,
    }));
    setOpenCombobox(false);
  };

  // Reset page on pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Re-fetch on page/pageSize change
  useEffect(() => {
    fetchAll(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchNucInstitutions();
  }, []);

  // Stats (computed from current page; total from server)
  const stats = {
    total: total,
    accredited: institutions.filter((i) => i.nuc_accredited).length,
    pending: institutions.filter((i) => i.verification_status === "pending")
      .length,
    verified: institutions.filter((i) => i.verification_status === "verified")
      .length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Institution Management"
          title="Institutions"
          description="Manage educational institutions"
          icon={<Building2 className="w-8 h-8" />}
        />
      </div>

      <div className="container py-8 space-y-6">
        {/* Add Button */}
        <div className="flex items-center justify-end">
          <Button
            style={{ backgroundColor: primaryColor, color: "white" }}
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add Institution
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Total Institutions
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {stats.total}
              </p>
            </div>
          </Card>
          <Card>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Accredited
              </p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {stats.accredited}
              </p>
            </div>
          </Card>
          <Card>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Pending
              </p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {stats.pending}
              </p>
            </div>
          </Card>
          <Card>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Verified
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {stats.verified}
              </p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="text-xl font-semibold">Institution List</h2>
            <Button size="sm" onClick={fetchAll} disabled={fetching}>
              Refresh
            </Button>
          </div>
          <Separator className="mb-2" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Accredited
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Contact Person
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Contact Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Contact Phone
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Bank Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Bank Account
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </TableHeader>
              <TableBody>
                {fetching ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8">
                      Loading...
                    </td>
                  </tr>
                ) : institutions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8">
                      No institutions found
                    </td>
                  </tr>
                ) : (
                  institutions.map((inst) => (
                    <tr key={inst.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{inst.name}</td>
                      <td className="px-4 py-2">{inst.type}</td>
                      <td className="px-4 py-2">
                        {inst.nuc_accredited ? (
                          <Badge className="bg-green-600/10 text-green-600">
                            Yes
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-600/10 text-yellow-600">
                            No
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {inst.verification_status === "verified" ? (
                          <Badge className="bg-blue-600/10 text-blue-600">
                            Verified
                          </Badge>
                        ) : inst.verification_status === "pending" ? (
                          <Badge className="bg-yellow-600/10 text-yellow-600">
                            Pending
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-400/10 text-gray-600">
                            {inst.verification_status || "-"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2">{inst.state}</td>
                      <td className="px-4 py-2">{inst.city}</td>
                      <td className="px-4 py-2">{inst.contact_person}</td>
                      <td className="px-4 py-2">{inst.contact_email}</td>
                      <td className="px-4 py-2">{inst.contact_phone}</td>
                      <td className="px-4 py-2">{inst.bank_name}</td>
                      <td className="px-4 py-2">{inst.bank_account_number}</td>
                      <td className="px-4 py-2">
                        {/* Future: Edit/Delete actions */}
                        <span className="text-xs text-muted-foreground">-</span>
                      </td>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {Math.max(1, Math.ceil(total / pageSize))}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))} disabled={currentPage >= Math.max(1, Math.ceil(total / pageSize))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Add Institution Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-150">
            <DialogHeader>
              <DialogTitle>Add Institution</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NUC Accredited Institution Selector */}
                <div className="col-span-full">
                  <Label>Select NUC Accredited Institution</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between"
                        type="button"
                      >
                        {selectedInstitution
                          ? selectedInstitution.name
                          : "Search and select institution..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search institutions..." />
                        <CommandEmpty>No institution found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {loadingNuc ? (
                            <div className="py-6 text-center text-sm">
                              Loading...
                            </div>
                          ) : (
                            nucInstitutions.map((inst) => (
                              <CommandItem
                                key={inst.name}
                                value={inst.name}
                                onSelect={() => handleSelectInstitution(inst)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedInstitution?.name === inst.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {inst.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {inst.type} • Est.{" "}
                                    {inst.year_of_establishment}
                                  </span>
                                </div>
                              </CommandItem>
                            ))
                          )}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select from NUC accredited institutions or fill manually
                    below
                  </p>
                </div>

                <div>
                  <Label htmlFor="id">Institution ID</Label>
                  <Input
                    name="id"
                    value={form.id}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={selectedInstitution !== null}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    name="type"
                    value={form.type}
                    onValueChange={(val) =>
                      setForm((f) => ({ ...f, type: val }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="polytechnic">Polytechnic</SelectItem>
                      <SelectItem value="college">College</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    name="nuc_accredited"
                    checked={form.nuc_accredited}
                    onChange={handleChange}
                    disabled={selectedInstitution !== null}
                  />
                  <Label htmlFor="nuc_accredited">NUC Accredited</Label>
                </div>
                <div>
                  <Label htmlFor="accreditation_number">
                    Accreditation Number
                  </Label>
                  <Input
                    name="accreditation_number"
                    value={form.accreditation_number}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bank_account_number">
                    Bank Account Number
                  </Label>
                  <Input
                    name="bank_account_number"
                    value={form.bank_account_number}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    name="bank_name"
                    value={form.bank_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bank_code">Bank Code</Label>
                  <Input
                    name="bank_code"
                    value={form.bank_code}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    name="contact_person"
                    value={form.contact_person}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    name="contact_email"
                    value={form.contact_email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    name="contact_phone"
                    value={form.contact_phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="verification_status">
                    Verification Status
                  </Label>
                  <Select
                    name="verification_status"
                    value={form.verification_status}
                    onValueChange={(val) =>
                      setForm((f) => ({ ...f, verification_status: val }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {error && <p className="text-red-500 mt-2">{error}</p>}
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  style={{ backgroundColor: primaryColor, color: "white" }}
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Add Institution"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
