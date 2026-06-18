import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Leaf, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import apiClient from "../services/api";

interface DeviceOrder {
  order_id: string;
  device_id: string;
  device_name: string;
  farmer_id: string;
  order_type: string;
  quantity: number;
  total_amount: number;
  delivery_state: string;
  status: string;
  payment_status: string;
  created_at: string;
}

interface AgTechDevice {
  device_id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  image_url?: string;
  manufacturer?: string;
  price: number;
  rental_price?: number;
  status: string;
  stock_quantity: number;
}

interface Manufacturer {
  manufacturer_id: string;
  name: string;
  country: string;
  website?: string;
  location?: string;
  owner?: string;
  document_url?: string;
  created_at: string;
}

interface ManufacturerForm {
  name: string;
  country: string;
  website: string;
  location: string;
  owner: string;
  document_url: string;
}

interface DeviceForm {
  name: string;
  type: string;
  category: string;
  description?: string;
  specifications?: Record<string, unknown>;
  price: string;
  rental_price?: string;
  manufacturer?: string;
  stock_quantity: string;
  image_url?: string;
  features?: string;
  status: string;
}

export default function AgricultureAgTech() {
  const [orders, setOrders] = useState<DeviceOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const ordersSectionRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<AgTechDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<AgTechDevice | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<DeviceForm>({
    name: "",
    type: "",
    category: "",
    description: "",
    specifications: {},
    price: "",
    rental_price: "",
    manufacturer: "",
    stock_quantity: "",
    image_url: "",
    features: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [specificationsRaw, setSpecificationsRaw] = useState("");
  const [specError, setSpecError] = useState<string | null>(null);
  
  // Manufacturer states
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [manufacturersLoading, setManufacturersLoading] = useState(false);
  const [showCreateManufacturer, setShowCreateManufacturer] = useState(false);
  const [manufacturerForm, setManufacturerForm] = useState<ManufacturerForm>({
    name: "",
    country: "",
    website: "",
    location: "",
    owner: "",
    document_url: "",
  });
  const [savingManufacturer, setSavingManufacturer] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showManufacturersList, setShowManufacturersList] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agtech/sensors",
      );
      setDevices(Array.isArray(response.data.sensors) ? response.data.sensors : []);
    } catch {
      toast.error("Failed to fetch AgTech devices");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agtech/alerts",
      );
      setOrders(Array.isArray(response.data.alerts) ? response.data.alerts : []);
    } catch {
      toast.error("Failed to fetch device orders");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchManufacturers = async () => {
    setManufacturersLoading(true);
    try {
      const response = await apiClient.get(
        "/agricultural/api/v1/agriculture/partners",
      );
      const partners = Array.isArray(response.data.partners)
        ? response.data.partners
        : Array.isArray(response.data.data)
          ? response.data.data
          : [];
      setManufacturers(partners);
    } catch {
      toast.error("Failed to fetch manufacturers");
      setManufacturers([]);
    } finally {
      setManufacturersLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);
  useEffect(() => {
    fetchOrders();
  }, []);
  useEffect(() => {
    fetchManufacturers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSpecError(null);
    let specificationsObj = {};
    if (specificationsRaw.trim()) {
      try {
        specificationsObj = JSON.parse(specificationsRaw);
      } catch {
        setSpecError("Invalid JSON in specifications");
        setSaving(false);
        return;
      }
    }
    try {
      const payload = {
        name: form.name,
        type: form.type,
        category: form.category,
        description: form.description,
        specifications: specificationsObj,
        price: parseFloat(form.price),
        rental_price: form.rental_price
          ? parseFloat(form.rental_price)
          : undefined,
        manufacturer: form.manufacturer,
        stock_quantity: parseInt(form.stock_quantity, 10),
        image_url: form.image_url,
        features: form.features
          ? form.features.split(",").map((f) => f.trim())
          : [],
        status: form.status,
      };
      await apiClient.post(
        "/agricultural/api/v1/agtech/sensors",
        payload,
      );
      toast.success("Device created");
      setShowCreate(false);
      setForm({
        name: "",
        type: "",
        category: "",
        description: "",
        specifications: {},
        price: "",
        rental_price: "",
        manufacturer: "",
        stock_quantity: "",
        image_url: "",
        features: "",
        status: "active",
      });
      setSpecificationsRaw("");
      fetchDevices();
    } catch {
      toast.error("Failed to create device");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this device?")) return;
    try {
      await apiClient.delete(
        `/agricultural/api/v1/agtech/sensors/${id}`,
      );
      toast.success("Device deleted");
      fetchDevices();
    } catch {
      toast.error("Failed to delete device");
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post(
        "/document/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data?.url) {
        setManufacturerForm((f) => ({ ...f, document_url: response.data.url }));
        toast.success("Document uploaded successfully");
      }
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleCreateManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingManufacturer(true);
    try {
      const payload = {
        name: manufacturerForm.name,
        country: manufacturerForm.country,
        website: manufacturerForm.website || undefined,
        location: manufacturerForm.location || undefined,
        owner: manufacturerForm.owner || undefined,
        document_url: manufacturerForm.document_url || undefined,
      };
      await apiClient.post(
        "/agricultural/api/v1/agriculture/partners/onboard",
        payload,
      );
      toast.success("Manufacturer registered");
      setShowCreateManufacturer(false);
      setManufacturerForm({
        name: "",
        country: "",
        website: "",
        location: "",
        owner: "",
        document_url: "",
      });
      fetchManufacturers();
    } catch {
      toast.error("Failed to register manufacturer");
    } finally {
      setSavingManufacturer(false);
    }
  };

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
              <BarChart3 className="w-8 h-8 text-blue-600" />
              AgTech Devices Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage all AgTech devices and orders
            </p>
          </div>
        </div>
        {/* Quick Navigation for Agriculture Modules */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <div
            className="block bg-card rounded-xl shadow-lg p-6 border border-border hover:bg-primary/10 transition cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-lg font-bold text-foreground">
                  AgTech Devices
                </div>
                <div className="text-sm text-muted-foreground">
                  Manage devices
                </div>
              </div>
            </div>
          </div>
          <button
            className="block bg-card rounded-xl shadow-lg p-6 border border-border hover:bg-primary/10 transition text-left w-full focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go to Device Orders section"
            onClick={() => {
              if (ordersSectionRef.current) {
                ordersSectionRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              } else {
                window.location.hash = "#device-orders-section";
              }
            }}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-lg font-bold text-foreground">
                  Device Orders
                </div>
                <div className="text-sm text-muted-foreground">
                  View all device orders
                </div>
              </div>
            </div>
          </button>
        </div>
        {/* Devices Actions */}
        <div className="flex justify-end gap-2 mb-4">
          <Button variant="outline" onClick={() => setShowManufacturersList(true)}>
            View Manufacturers
          </Button>
          <Button variant="outline" onClick={() => setShowCreateManufacturer(true)}>
            Add Manufacturer
          </Button>
          <Button onClick={() => setShowCreate(true)}>Add Device</Button>
        </div>
        {/* Devices Table */}
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading devices...
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Device ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Manufacturer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Rental Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Stock
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
                  {devices.map((device) => (
                    <tr
                      key={device.device_id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.device_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.manufacturer || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.rental_price ?? "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.stock_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.status}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowModal(true);
                          }}
                        >
                          Full Details
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(device.device_id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {/* Create Device Modal */}
        {showCreate && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreate(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Add AgTech Device</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Name</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Type</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    required
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Status</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Category</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    required
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Description</label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Specifications (JSON)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={specificationsRaw}
                    onChange={(e) => setSpecificationsRaw(e.target.value)}
                  />
                  {specError && (
                    <div className="text-red-600 text-sm mt-1">{specError}</div>
                  )}
                </div>
                <div>
                  <label className="block mb-1 font-medium">Price</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="number"
                    required
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Rental Price</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="number"
                    value={form.rental_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rental_price: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Manufacturer</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={form.manufacturer}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, manufacturer: e.target.value }))
                    }
                  >
                    <option value="">Select a manufacturer</option>
                    {manufacturers.map((mfr) => (
                      <option key={mfr.manufacturer_id} value={mfr.name}>
                        {mfr.name} ({mfr.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Stock Quantity
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="number"
                    required
                    value={form.stock_quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stock_quantity: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Image URL</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={form.image_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, image_url: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Features (comma separated)
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={form.features}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, features: e.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Create"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Manufacturers List Modal */}
        {showManufacturersList && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowManufacturersList(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-6xl w-full mx-4 border border-border max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Manufacturers List</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowManufacturersList(false);
                    setShowCreateManufacturer(true);
                  }}
                >
                  Add New
                </Button>
              </div>
              <div className="overflow-x-auto">
                {manufacturersLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading manufacturers...
                  </div>
                ) : manufacturers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No manufacturers found. Create one to get started.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Manufacturer ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Country
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Owner
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Website
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Document
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {manufacturers.map((mfr) => (
                        <tr
                          key={mfr.manufacturer_id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                            {mfr.manufacturer_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">
                            {mfr.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mfr.country}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mfr.location || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mfr.owner || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mfr.website ? (
                              <a
                                href={mfr.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Visit
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mfr.document_url ? (
                              <a
                                href={`https://${mfr.document_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                View Doc
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(mfr.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setShowManufacturersList(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Create Manufacturer Modal */}
        {showCreateManufacturer && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateManufacturer(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Register Manufacturer</h2>
              <form onSubmit={handleCreateManufacturer} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Name *</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    required
                    value={manufacturerForm.name}
                    onChange={(e) =>
                      setManufacturerForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Country *</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    required
                    value={manufacturerForm.country}
                    onChange={(e) =>
                      setManufacturerForm((f) => ({ ...f, country: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Website</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="url"
                    value={manufacturerForm.website}
                    onChange={(e) =>
                      setManufacturerForm((f) => ({ ...f, website: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Location</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={manufacturerForm.location}
                    onChange={(e) =>
                      setManufacturerForm((f) => ({ ...f, location: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Owner</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={manufacturerForm.owner}
                    onChange={(e) =>
                      setManufacturerForm((f) => ({ ...f, owner: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Document Upload</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="file"
                    onChange={handleDocumentUpload}
                    disabled={uploadingDocument}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  {uploadingDocument && (
                    <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                  )}
                  {manufacturerForm.document_url && (
                    <p className="text-sm text-green-600 mt-1">✓ Document uploaded</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateManufacturer(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingManufacturer}>
                    {savingManufacturer ? "Saving..." : "Register"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Device Details Modal */}
        {showModal && selectedDevice && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Device Details</h2>
              <p>
                <b>Device ID:</b> {selectedDevice.device_id}
              </p>
              <p>
                <b>Name:</b> {selectedDevice.name}
              </p>
              <p>
                <b>Type:</b> {selectedDevice.type}
              </p>
              <p>
                <b>Category:</b> {selectedDevice.category}
              </p>
              <p>
                <b>Description:</b> {selectedDevice.description || "-"}
              </p>
              <p>
                <b>Manufacturer:</b> {selectedDevice.manufacturer || "-"}
              </p>
              <p>
                <b>Price:</b> {selectedDevice.price}
              </p>
              <p>
                <b>Rental Price:</b> {selectedDevice.rental_price ?? "-"}
              </p>
              <p>
                <b>Stock Quantity:</b> {selectedDevice.stock_quantity}
              </p>
              <p>
                <b>Status:</b> {selectedDevice.status}
              </p>
              <p>
                <b>Image URL:</b> {selectedDevice.image_url || "-"}
              </p>
              <Button className="mt-4" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
        {/* Device Orders Table */}
        <div
          ref={ordersSectionRef}
          id="device-orders-section"
          className="mt-12 scroll-mt-24"
        >
          <h2 className="text-2xl font-bold mb-4">Device Orders</h2>
          <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              {ordersLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading orders...
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Device Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Farmer ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Order Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Delivery State
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Payment Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Created At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => (
                      <tr
                        key={order.order_id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                          {order.order_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {order.device_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {order.farmer_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          {order.order_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-green-600">
                          ₦{(order.total_amount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          {order.delivery_state}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                              order.status === "pending"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : order.status === "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : order.status === "cancelled"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                              order.payment_status === "pending"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                : order.payment_status === "paid"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  : order.payment_status === "failed"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                            }`}
                          >
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
