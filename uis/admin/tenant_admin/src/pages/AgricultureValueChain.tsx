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
    CheckCircle,
    Clock,
    Eye,
    Factory,
    FileText,
    Package,
    Send,
    Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface EquipmentLoan {
  loan_id: string;
  borrower_id: string;
  equipment_type: string;
  loan_amount: number;
  status: string;
  created_at: string;
}

interface Processor {
  processor_id: string;
  name: string;
  location: string;
  commodity_type: string;
  status: string;
}

interface Invoice {
  invoice_id: string;
  supplier_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
}

interface ExportLoan {
  loan_id: string;
  exporter_id: string;
  commodity: string;
  loan_amount: number;
  status: string;
  created_at: string;
}

type ActiveTab = "equipment" | "processors" | "invoices" | "export";

export default function AgricultureValueChain() {
  const { primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<ActiveTab>("equipment");
  const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [exportLoans, setExportLoans] = useState<ExportLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/value-chain/equipment/loans")
        .catch(() => ({ data: { loans: [] } }));
      setEquipmentLoans(res.data?.loans || []);
    } catch {
      toast.error("Failed to fetch equipment loans");
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessors = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/value-chain/processors")
        .catch(() => ({ data: { processors: [] } }));
      setProcessors(res.data?.processors || []);
    } catch {
      toast.error("Failed to fetch processors");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/value-chain/invoices")
        .catch(() => ({ data: { invoices: [] } }));
      setInvoices(res.data?.invoices || []);
    } catch {
      toast.error("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchExportLoans = async () => {
    setLoading(true);
    try {
      const res = await apiClient
        .get("/agricultural/api/v1/value-chain/export-loans")
        .catch(() => ({ data: { loans: [] } }));
      setExportLoans(res.data?.loans || []);
    } catch {
      toast.error("Failed to fetch export loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "equipment") fetchEquipment();
    else if (activeTab === "processors") fetchProcessors();
    else if (activeTab === "invoices") fetchInvoices();
    else if (activeTab === "export") fetchExportLoans();
  }, [activeTab]);

  const handleApproveEquipmentLoan = async (loanId: string) => {
    if (!confirm(`Approve equipment loan ${loanId}?`)) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/agricultural/api/v1/value-chain/equipment/loans/${loanId}/approve`, {});
      toast.success("Equipment loan approved");
      fetchEquipment();
    } catch {
      toast.error("Failed to approve equipment loan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburseEquipmentLoan = async (loanId: string) => {
    if (!confirm(`Disburse equipment loan ${loanId}?`)) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/agricultural/api/v1/value-chain/equipment/loans/${loanId}/disburse`, {});
      toast.success("Equipment loan disbursed");
      fetchEquipment();
    } catch {
      toast.error("Failed to disburse equipment loan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyInvoice = async (invoiceId: string) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/agricultural/api/v1/value-chain/invoices/${invoiceId}/verify`, {});
      toast.success("Invoice verified");
      fetchInvoices();
    } catch {
      toast.error("Failed to verify invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscountInvoice = async (invoiceId: string) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/agricultural/api/v1/value-chain/invoices/${invoiceId}/discount`, {});
      toast.success("Invoice discounted");
      fetchInvoices();
    } catch {
      toast.error("Failed to discount invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveExportLoan = async (loanId: string) => {
    if (!confirm(`Approve export loan ${loanId}?`)) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/agricultural/api/v1/value-chain/export-loans/${loanId}/approve`, {});
      toast.success("Export loan approved");
      fetchExportLoans();
    } catch {
      toast.error("Failed to approve export loan");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      approved: "default",
      disbursed: "default",
      pending: "secondary",
      completed: "default",
      defaulted: "destructive",
      rejected: "destructive",
      verified: "default",
      discounted: "secondary",
      settled: "default",
      active: "default",
    };
    return <Badge variant={map[status] || "secondary"}>{status}</Badge>;
  };

  const tabs = [
    { key: "equipment" as ActiveTab, label: "Equipment Finance", icon: Package },
    { key: "processors" as ActiveTab, label: "Processors", icon: Factory },
    { key: "invoices" as ActiveTab, label: "Invoice Finance", icon: FileText },
    { key: "export" as ActiveTab, label: "Export Finance", icon: Truck },
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
              <Truck className="w-8 h-8" style={{ color: primaryColor }} />
              Value Chain Finance
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Equipment finance, processor loans, invoice finance, and export finance
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-muted p-1 rounded-lg w-fit flex-wrap">
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

        {/* Equipment Loans */}
        {!loading && activeTab === "equipment" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {equipmentLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No equipment loans found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Loan ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Borrower</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Equipment</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Amount</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {equipmentLoans.map((loan) => (
                    <tr key={loan.loan_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{loan.loan_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{loan.borrower_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{loan.equipment_type}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{loan.loan_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4">{getStatusBadge(loan.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(loan); setShowModal(true); }}>
                            <Eye className="w-4 h-4 mr-1" />View
                          </Button>
                          {loan.status === "pending" && (
                            <Button size="sm" style={{ backgroundColor: primaryColor }} className="text-white"
                              onClick={() => handleApproveEquipmentLoan(loan.loan_id)} disabled={actionLoading}>
                              <CheckCircle className="w-3 h-3 mr-1" />Approve
                            </Button>
                          )}
                          {loan.status === "approved" && (
                            <Button size="sm" style={{ backgroundColor: primaryColor }} className="text-white"
                              onClick={() => handleDisburseEquipmentLoan(loan.loan_id)} disabled={actionLoading}>
                              <Send className="w-3 h-3 mr-1" />Disburse
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
        )}

        {/* Processors */}
        {!loading && activeTab === "processors" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {processors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No processors registered</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Processor ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Name</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Commodity</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {processors.map((p) => (
                    <tr key={p.processor_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{p.processor_id}</td>
                      <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.location || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{p.commodity_type || "—"}</td>
                      <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Invoices */}
        {!loading && activeTab === "invoices" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No invoices found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Invoice ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Supplier</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Amount</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Due Date</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.invoice_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{inv.invoice_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{inv.supplier_id}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{inv.amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {inv.status === "submitted" && (
                            <Button size="sm" variant="outline" onClick={() => handleVerifyInvoice(inv.invoice_id)} disabled={actionLoading}>
                              Verify
                            </Button>
                          )}
                          {inv.status === "verified" && (
                            <Button size="sm" style={{ backgroundColor: primaryColor }} className="text-white"
                              onClick={() => handleDiscountInvoice(inv.invoice_id)} disabled={actionLoading}>
                              Discount
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
        )}

        {/* Export Loans */}
        {!loading && activeTab === "export" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {exportLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>No export loans found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Loan ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Exporter</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Commodity</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Amount</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exportLoans.map((loan) => (
                    <tr key={loan.loan_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{loan.loan_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{loan.exporter_id}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{loan.commodity}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{loan.loan_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4">{getStatusBadge(loan.status)}</td>
                      <td className="px-6 py-4">
                        {loan.status === "pending" && (
                          <Button size="sm" style={{ backgroundColor: primaryColor }} className="text-white"
                            onClick={() => handleApproveExportLoan(loan.loan_id)} disabled={actionLoading}>
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Details Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Item Details</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedItem).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm font-medium">{String(val) || "—"}</p>
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
