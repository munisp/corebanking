/**
 * White Label Config Workspace — White-label operators customize sub-tenant feature sets.
 * This page allows white-label partners to configure which services their
 * downstream tenants can access, within the bounds of their own enabled modules.
 */

import { useCallback, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Globe,
  Layers,
  Palette,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

import AdminWorkspaceLayout from "@/components/AdminWorkspaceLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FLAG_CATEGORIES } from "@/hooks/useFeatureFlags";

interface WhiteLabelPartner {
  id: string;
  name: string;
  domain: string;
  primaryColor: string;
  logoUrl: string;
  enabledModules: string[];
  maxSubTenants: number;
  subTenants: SubTenant[];
}

interface SubTenant {
  id: string;
  name: string;
  type: string;
  enabledModules: string[];
  status: string;
}

const SEED_PARTNERS: WhiteLabelPartner[] = [
  {
    id: "WL-STERLING",
    name: "Sterling Bank Digital",
    domain: "digital.sterlingbank.ng",
    primaryColor: "#E31937",
    logoUrl: "/logos/sterling.png",
    enabledModules: FLAG_CATEGORIES.map((c) => c.key),
    maxSubTenants: 50,
    subTenants: [
      {
        id: "SUB-001",
        name: "Sterling MFB Oyo",
        type: "microfinance_bank",
        enabledModules: ["core_banking", "payments", "mobile_money", "lending", "microfinance", "accounting", "billing"],
        status: "active",
      },
      {
        id: "SUB-002",
        name: "Sterling Agri Partners",
        type: "agent_banking",
        enabledModules: ["core_banking", "payments", "mobile_money", "agent_banking", "agriculture_banking", "billing"],
        status: "active",
      },
    ],
  },
  {
    id: "WL-WEMA",
    name: "ALAT by Wema",
    domain: "alat.ng",
    primaryColor: "#6C3B9B",
    logoUrl: "/logos/alat.png",
    enabledModules: [
      "core_banking", "payments", "cards_digital", "mobile_money", "lending",
      "accounting", "risk_compliance", "billing", "wealth_management",
    ],
    maxSubTenants: 20,
    subTenants: [
      {
        id: "SUB-003",
        name: "ALAT Youth Segment",
        type: "digital_bank",
        enabledModules: ["core_banking", "payments", "cards_digital", "mobile_money", "billing"],
        status: "active",
      },
    ],
  },
  {
    id: "WL-LAPO",
    name: "LAPO Microfinance",
    domain: "banking.lapo-mfb.com",
    primaryColor: "#0066B3",
    logoUrl: "/logos/lapo.png",
    enabledModules: [
      "core_banking", "payments", "mobile_money", "lending", "microfinance",
      "accounting", "risk_compliance", "billing", "cooperative_banking", "agriculture_banking",
    ],
    maxSubTenants: 100,
    subTenants: [
      {
        id: "SUB-004",
        name: "LAPO Edo State",
        type: "microfinance_bank",
        enabledModules: ["core_banking", "payments", "mobile_money", "lending", "microfinance", "accounting", "billing"],
        status: "active",
      },
      {
        id: "SUB-005",
        name: "LAPO Delta Agri",
        type: "agent_banking",
        enabledModules: ["core_banking", "payments", "mobile_money", "agriculture_banking", "billing"],
        status: "active",
      },
      {
        id: "SUB-006",
        name: "LAPO Women Cooperative",
        type: "cooperative",
        enabledModules: ["core_banking", "payments", "mobile_money", "cooperative_banking", "lending", "billing"],
        status: "active",
      },
    ],
  },
];

export default function WhiteLabelConfigWorkspace() {
  const [partners, setPartners] = useState<WhiteLabelPartner[]>(SEED_PARTNERS);
  const [selectedPartner, setSelectedPartner] = useState<string>(SEED_PARTNERS[0].id);
  const [selectedSubTenant, setSelectedSubTenant] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSubTenantName, setNewSubTenantName] = useState("");
  const [newSubTenantType, setNewSubTenantType] = useState("microfinance_bank");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const partner = partners.find((p) => p.id === selectedPartner) ?? partners[0];
  const subTenant = selectedSubTenant
    ? partner.subTenants.find((s) => s.id === selectedSubTenant)
    : null;

  const toggleSubTenantModule = useCallback(
    (subId: string, moduleKey: string) => {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== selectedPartner) return p;
          return {
            ...p,
            subTenants: p.subTenants.map((s) => {
              if (s.id !== subId) return s;
              const modules = s.enabledModules.includes(moduleKey)
                ? s.enabledModules.filter((m) => m !== moduleKey)
                : [...s.enabledModules, moduleKey];
              return { ...s, enabledModules: modules };
            }),
          };
        }),
      );
    },
    [selectedPartner],
  );

  const addSubTenant = useCallback(() => {
    if (!newSubTenantName.trim()) return;
    const newSub: SubTenant = {
      id: `SUB-${Date.now()}`,
      name: newSubTenantName,
      type: newSubTenantType,
      enabledModules: ["core_banking", "payments", "billing"],
      status: "active",
    };
    setPartners((prev) =>
      prev.map((p) =>
        p.id === selectedPartner
          ? { ...p, subTenants: [...p.subTenants, newSub] }
          : p,
      ),
    );
    setShowAddDialog(false);
    setNewSubTenantName("");
  }, [newSubTenantName, newSubTenantType, selectedPartner]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/db/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner.id, subTenants: partner.subTenants }),
      });
    } catch {
      // Save locally
    }
    setSaving(false);
  }, [partner]);

  return (
    <AdminWorkspaceLayout
      eyebrow="White Label Operations"
      title="White Label Configuration"
      description="Configure service modules for white-label partners and their sub-tenants. Partners can only assign modules they themselves have enabled."
    >
      <div className="space-y-6 p-6">
        {/* Partner Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette size={20} />
              White Label Partner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedPartner} onValueChange={(v) => {
                setSelectedPartner(v);
                setSelectedSubTenant(null);
              }}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm">
                <div
                  className="h-6 w-6 rounded-full border border-slate-200"
                  style={{ backgroundColor: partner.primaryColor }}
                />
                <span className="text-slate-500">{partner.domain}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">
                {partner.enabledModules.length} / {FLAG_CATEGORIES.length} modules available
              </Badge>
              <Badge variant="outline">
                {partner.subTenants.length} / {partner.maxSubTenants} sub-tenants
              </Badge>
              <Badge
                variant="outline"
                className={
                  partner.subTenants.every((s) => s.status === "active")
                    ? "border-emerald-200 text-emerald-700"
                    : "border-amber-200 text-amber-700"
                }
              >
                {partner.subTenants.filter((s) => s.status === "active").length} active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sub-Tenant List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Sub-Tenants</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </div>

            {partner.subTenants.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubTenant(sub.id)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  selectedSubTenant === sub.id
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-900">{sub.name}</span>
                  <Badge
                    variant={sub.status === "active" ? "default" : "secondary"}
                    className="text-xs capitalize"
                  >
                    {sub.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="capitalize">{sub.type.replace(/_/g, " ")}</span>
                  <span>&middot;</span>
                  <span>{sub.enabledModules.length} modules</span>
                </div>
              </button>
            ))}
          </div>

          {/* Module Configuration */}
          <div className="lg:col-span-2 space-y-3">
            {subTenant ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{subTenant.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure which modules this sub-tenant can access
                    </p>
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save size={14} className="mr-1" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {FLAG_CATEGORIES.map((cat) => {
                    const partnerHasModule = partner.enabledModules.includes(cat.key);
                    const subHasModule = subTenant.enabledModules.includes(cat.key);

                    return (
                      <div
                        key={cat.key}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                          !partnerHasModule
                            ? "border-slate-100 bg-slate-50 opacity-50"
                            : subHasModule
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${subHasModule ? "text-slate-900" : "text-slate-500"}`}>
                              {cat.label}
                            </span>
                            {!partnerHasModule && (
                              <Badge variant="secondary" className="text-xs">Not in partner plan</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => partnerHasModule && toggleSubTenantModule(subTenant.id, cat.key)}
                          disabled={!partnerHasModule}
                          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                            !partnerHasModule
                              ? "bg-slate-200 cursor-not-allowed"
                              : subHasModule
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                          }`}
                          role="switch"
                          aria-checked={subHasModule}
                          aria-label={`Toggle ${cat.label}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              subHasModule ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">
                <div className="text-center">
                  <Users size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Select a sub-tenant to configure modules</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Sub-Tenant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sub-Tenant</DialogTitle>
            <DialogDescription>
              Create a new sub-tenant under {partner.name}. You can configure their modules after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="subTenantName">Name</Label>
              <Input
                id="subTenantName"
                value={newSubTenantName}
                onChange={(e) => setNewSubTenantName(e.target.value)}
                placeholder="e.g., Sterling MFB Lagos"
              />
            </div>
            <div>
              <Label htmlFor="subTenantType">Type</Label>
              <Select value={newSubTenantType} onValueChange={setNewSubTenantType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="microfinance_bank">Microfinance Bank</SelectItem>
                  <SelectItem value="agent_banking">Agent Banking</SelectItem>
                  <SelectItem value="digital_bank">Digital Bank</SelectItem>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="payment_service_bank">Payment Service Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={addSubTenant} disabled={!newSubTenantName.trim()}>Create Sub-Tenant</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceLayout>
  );
}
