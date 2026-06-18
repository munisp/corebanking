import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CheckCircle,
    Eye,
    Globe,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface Partner {
  partner_id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  contact_email: string;
  created_at: string;
}

interface GovProgram {
  program_id: string;
  code: string;
  name: string;
  description: string;
  interest_rate: number;
  max_loan_amount: number;
  eligible_crops: string[];
  is_active: boolean;
}

interface Cooperative {
  cooperative_id: string;
  name: string;
  location: string;
  member_count: number;
  status: string;
  created_at: string;
}

type ActiveTab = "partners" | "programs" | "cooperatives";

export default function AgriculturePartners() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [programs, setPrograms] = useState<GovProgram[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollLoanId, setEnrollLoanId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/agriculture/partners", { params: { page, limit } })
        .catch(() => ({ data: { partners: [], total: 0 } }));
      setPartners(res.data?.partners || []);
      setTotal(res.data?.total ?? res.data?.count ?? res.data?.partners?.length ?? 0);
    } catch {
      toast.error("Failed to fetch partners");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/agriculture/programs", { params: { page, limit } })
        .catch(() => ({ data: { programs: [], total: 0 } }));
      setPrograms(res.data?.programs || []);
      setTotal(res.data?.total ?? res.data?.count ?? res.data?.programs?.length ?? 0);
    } catch {
      toast.error("Failed to fetch government programs");
    } finally {
      setLoading(false);
    }
  };

  const fetchCooperatives = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/agriculture/cooperatives", { params: { page, limit } })
        .catch(() => ({ data: { cooperatives: [], total: 0 } }));
      setCooperatives(res.data?.cooperatives || []);
      setTotal(res.data?.total ?? res.data?.count ?? res.data?.cooperatives?.length ?? 0);
    } catch {
      toast.error("Failed to fetch cooperatives");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === "partners") fetchPartners();
    else if (activeTab === "programs") fetchPrograms();
    else if (activeTab === "cooperatives") fetchCooperatives();
  }, [activeTab, page]);

  const handleEnrollProgram = async (programCode: string) => {
    if (!enrollLoanId.trim()) {
      toast.error("Enter a loan ID to enroll");
      return;
    }
    setEnrollingId(programCode);
    try {
      await apiClient.post("/agricultural/api/v1/agriculture/programs/enroll", {
        program_code: programCode,
        loan_id: enrollLoanId,
      });
      toast.success("Loan enrolled in program successfully");
      setEnrollLoanId("");
    } catch {
      toast.error("Failed to enroll in program");
    } finally {
      setEnrollingId(null);
    }
  };

  const getStatusBadge = (status: string) => (
    <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
  );

  const tabs = [
    { key: "partners" as ActiveTab, label: "Partners", icon: Building2 },
    { key: "programs" as ActiveTab, label: "Government Programs", icon: Globe },
    { key: "cooperatives" as ActiveTab, label: "Cooperatives", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="border-b border-border bg-background/50 backdrop-blur-sm mb-8">
          <div className="py-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/agriculture-banking">
                <a>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Agriculture Banking
                  </Button>
                </a>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Building2 className="w-8 h-8" style={{ color: primaryColor }} />
              Partners & Programs
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage ecosystem partners, government intervention programs, and cooperatives
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted p-1 rounded-lg w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Partners */}
        {!loading && activeTab === "partners" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {partners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No partners registered</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Partner ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Contact</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {partners.map((p) => (
                    <tr key={p.partner_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{p.partner_id}</td>
                      <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{p.type?.replace(/_/g, " ")}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.location || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.contact_email || "—"}</td>
                      <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(p); setShowModal(true); }}>
                          <Eye className="w-4 h-4 mr-1" />View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Government Programs */}
        {!loading && activeTab === "programs" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <Globe className="w-5 h-5 shrink-0" style={{ color: primaryColor }} />
              <span className="text-sm font-medium">Enroll Loan in Program</span>
              <input
                type="text"
                placeholder="Loan ID"
                value={enrollLoanId}
                onChange={(e) => setEnrollLoanId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {programs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mb-4" />
                  <p>No government programs available</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Code</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Program Name</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Interest Rate</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Max Loan</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {programs.map((prog) => (
                      <tr key={prog.program_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-mono font-medium">{prog.code}</td>
                        <td className="px-6 py-4 text-sm font-medium">{prog.name}</td>
                        <td className="px-6 py-4 text-sm">{prog.interest_rate != null ? `${prog.interest_rate}%` : "—"}</td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          {prog.max_loan_amount ? `₦${prog.max_loan_amount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={prog.is_active ? "default" : "secondary"}>
                            {prog.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedItem(prog); setShowModal(true); }}
                            >
                              <Eye className="w-4 h-4 mr-1" />Details
                            </Button>
                            {prog.is_active && (
                              <Button
                                size="sm"
                                style={{ backgroundColor: primaryColor }}
                                className="text-white"
                                onClick={() => handleEnrollProgram(prog.code)}
                                disabled={enrollingId === prog.code}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {enrollingId === prog.code ? "Enrolling..." : "Enroll"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Cooperatives */}
        {!loading && activeTab === "cooperatives" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {cooperatives.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No cooperatives registered</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Cooperative ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Members</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Registered</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cooperatives.map((c) => (
                    <tr key={c.cooperative_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{c.cooperative_id}</td>
                      <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{c.location || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold">{c.member_count ?? "—"}</td>
                      <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedItem(c); setShowModal(true); }}
                        >
                          <Eye className="w-4 h-4 mr-1" />View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-card">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / limit)} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}

        {/* Details Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Details</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedItem).map(([key, val]) => (
                  <div key={key} className={Array.isArray(val) ? "col-span-2" : ""}>
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm font-medium">
                      {Array.isArray(val) ? val.join(", ") || "—" : String(val) || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
