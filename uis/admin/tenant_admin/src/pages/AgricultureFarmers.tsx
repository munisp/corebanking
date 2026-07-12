import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Leaf, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface Farmer {
  farm_location: string;
  farm_size: number;
  farmer_id: string;
  full_name: string;
  kyc_verified: boolean;
  phone_number: string;
  status: string;
  years_experience: number;
}

export default function AgricultureFarmers() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agriculture/farmers",
        { params: { page, limit } },
      );
      setFarmers(
        Array.isArray(response.data.farmers) ? response.data.farmers : [],
      );
      setTotal(response.data.total ?? response.data.count ?? response.data.farmers?.length ?? 0);
    } catch (e) {
      toast.error("Failed to fetch farmers");
      setFarmers([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFarmers(); }, [page]);

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        {/* Header and Navigation */}
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
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Farmers Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage all registered farmers
            </p>
          </div>
        </div>
        {/* Quick Navigation for Agriculture Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/agriculture-farmers">
            <a className="block bg-card rounded-xl shadow-lg p-6 border border-border hover:bg-primary/10 transition">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <div className="text-lg font-bold text-foreground">
                    Farmers
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Manage all registered farmers
                  </div>
                </div>
              </div>
            </a>
          </Link>
          <Link href="/agriculture-farms">
            <a className="block bg-card rounded-xl shadow-lg p-6 border border-border hover:bg-primary/10 transition">
              <div className="flex items-center gap-3">
                <Leaf className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-lg font-bold text-foreground">Farms</div>
                  <div className="text-sm text-muted-foreground">
                    View and verify farms
                  </div>
                </div>
              </div>
            </a>
          </Link>
          <Link href="/agriculture-agtech">
            <a className="block bg-card rounded-xl shadow-lg p-6 border border-border hover:bg-primary/10 transition">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-lg font-bold text-foreground">
                    AgTech Devices
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Manage devices & orders
                  </div>
                </div>
              </div>
            </a>
          </Link>
        </div>
        {/* Farmers Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading farmers...
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Farm Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Farm Size (ha)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Years Exp.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      KYC
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {farmers.map((farmer) => (
                    <tr
                      key={farmer.farmer_id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.phone_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.farm_location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.farm_size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.years_experience}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.kyc_verified ? "Verified" : "Unverified"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farmer.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFarmer(farmer);
                            setShowModal(true);
                          }}
                        >
                          Full Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(total / limit))} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
        {/* Farmer Details Modal */}
        {showModal && selectedFarmer && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Farmer Details</h2>
              <p>
                <b>Full Name:</b> {selectedFarmer.full_name}
              </p>
              <p>
                <b>Phone Number:</b> {selectedFarmer.phone_number}
              </p>
              <p>
                <b>Farm Location:</b> {selectedFarmer.farm_location}
              </p>
              <p>
                <b>Farm Size (ha):</b> {selectedFarmer.farm_size}
              </p>
              <p>
                <b>Years Experience:</b> {selectedFarmer.years_experience}
              </p>
              <p>
                <b>KYC Verified:</b>{" "}
                {selectedFarmer.kyc_verified ? "Yes" : "No"}
              </p>
              <p>
                <b>Status:</b> {selectedFarmer.status}
              </p>
              <Button className="mt-4" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
