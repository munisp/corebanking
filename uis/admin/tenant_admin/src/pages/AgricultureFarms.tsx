import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Leaf, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface Farm {
  current_crop: string;
  farm_id: string;
  farmer_id: string;
  irrigation_type: string;
  location: string;
  size: number;
  soil_type: string;
  status: string;
}

export default function AgricultureFarms() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agriculture/farms",
        { params: { page, limit } },
      );
      setFarms(Array.isArray(response.data.farms) ? response.data.farms : []);
      setTotal(response.data.total ?? response.data.count ?? response.data.farms?.length ?? 0);
    } catch (e) {
      toast.error("Failed to fetch farms");
      setFarms([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFarms(); }, [page]);

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
              <Leaf className="w-8 h-8 text-green-600" />
              Farm Management
            </h1>
            <p className="text-muted-foreground mt-1">
              View and verify all registered farms
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
        {/* Farms Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading farms...
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Farm ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Farmer ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Size (ha)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Current Crop
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Soil Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Irrigation
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
                  {farms.map((farm) => (
                    <tr
                      key={farm.farm_id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.farm_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.farmer_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.current_crop}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.soil_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.irrigation_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {farm.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedFarm(farm);
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
        {/* Farm Details Modal */}
        {showModal && selectedFarm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Farm Details</h2>
              <p>
                <b>Farm ID:</b> {selectedFarm.farm_id}
              </p>
              <p>
                <b>Farmer ID:</b> {selectedFarm.farmer_id}
              </p>
              <p>
                <b>Location:</b> {selectedFarm.location}
              </p>
              <p>
                <b>Size (ha):</b> {selectedFarm.size}
              </p>
              <p>
                <b>Current Crop:</b> {selectedFarm.current_crop}
              </p>
              <p>
                <b>Soil Type:</b> {selectedFarm.soil_type}
              </p>
              <p>
                <b>Irrigation Type:</b> {selectedFarm.irrigation_type}
              </p>
              <p>
                <b>Status:</b> {selectedFarm.status}
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
