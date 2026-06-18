import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  cancelProduct,
  getAllProducts,
  getProductById,
  updateProductStatus,
} from "@/services/islamicBanking";
import {
  Activity,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Eye,
  HandCoins,
  Home,
  Landmark,
  Plus,
  Search,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import IslamicBankingApplicationForm from "../components/forms/IslamicBankingApplicationForm";

interface IslamicProduct {
  id: string;
  reference_number: string;
  product_type: string;
  user_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export default function IslamicBanking() {
  const { primaryColor } = useTenantBranding();
  const [products, setProducts] = useState<IslamicProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<IslamicProduct | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDetails, setShowDetails] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setPage(1);
    fetchAllProducts();
  }, [productTypeFilter]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await getAllProducts();

      // Filter by product type if needed
      const filteredProducts =
        productTypeFilter === "all"
          ? allProducts
          : allProducts.filter(
              (p: IslamicProduct) => p.product_type === productTypeFilter,
            );

      setProducts(Array.isArray(filteredProducts) ? filteredProducts : []);
    } catch (error) {
      toast.error("Failed to fetch Islamic banking products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = async (product: IslamicProduct) => {
    setSelectedProduct(product);
    setShowDetails(true);
    setLoading(true);

    try {
      const detailedProduct = await getProductById(product.id);
      setSelectedProduct(detailedProduct || product);
    } catch (error) {
      toast.error("Failed to fetch product details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    productId: string,
    productType: string,
    newStatus: string,
  ) => {
    if (processingIds.has(productId)) return;

    setProcessingIds((prev) => new Set(prev).add(productId));
    setLoading(true);

    try {
      await updateProductStatus(productId, newStatus);
      toast.success("Product status updated successfully");
      await fetchAllProducts();
      setShowDetails(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error("Failed to update product status");
    } finally {
      setLoading(false);
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const handleCancel = async (productId: string, productType: string) => {
    if (processingIds.has(productId)) return;
    if (!confirm("Are you sure you want to cancel this product?")) return;

    setProcessingIds((prev) => new Set(prev).add(productId));
    setLoading(true);

    try {
      await cancelProduct(productId);
      toast.success("Product cancelled successfully");
      await fetchAllProducts();
      setShowDetails(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error("Failed to cancel product");
    } finally {
      setLoading(false);
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        searchTerm === "" ||
        product.reference_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        product.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

  const paginatedProducts = useMemo(
    () => filteredProducts.slice((page - 1) * limit, page * limit),
    [filteredProducts, page, limit],
  );

  const stats = useMemo(() => {
    const total = products.length;
    const pending = products.filter((p) => p.status === "pending").length;
    const approved = products.filter((p) => p.status === "approved").length;
    const active = products.filter((p) => p.status === "active").length;
    const rejected = products.filter((p) => p.status === "rejected").length;

    return { total, pending, approved, active, rejected };
  }, [products]);

  const handleExportExcel = () => {
    const data = filteredProducts.map((p) => ({
      "Reference Number": p.reference_number,
      "Product Type": p.product_type,
      Status: p.status,
      "User ID": p.user_id,
      "Created At": new Date(p.created_at).toLocaleDateString(),
      "Updated At": new Date(p.updated_at).toLocaleDateString(),
    }));
    exportToExcel(data, "islamic-banking-products");
  };

  const handleExportPDF = () => {
    const data = filteredProducts.map((p) => [
      p.reference_number,
      p.product_type,
      p.status,
      p.user_id,
      new Date(p.created_at).toLocaleDateString(),
    ]);
    exportToPDF(
      data,
      ["Reference", "Product Type", "Status", "User ID", "Created"],
      "islamic-banking-products-report",
      "Islamic Banking Products Report",
    );
  };

  const getProductIcon = (type: string) => {
    switch (type) {
      case "murabaha":
        return <Building2 className="w-5 h-5" />;
      case "musharaka":
        return <HandCoins className="w-5 h-5" />;
      case "ijara":
        return <Home className="w-5 h-5" />;
      case "takaful":
        return <Shield className="w-5 h-5" />;
      case "sukuk":
        return <Landmark className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getProductTypeName = (type: string) => {
    const names: Record<string, string> = {
      murabaha: "Murabaha (Cost-Plus)",
      musharaka: "Musharaka (Partnership)",
      ijara: "Ijara (Leasing)",
      takaful: "Takaful (Insurance)",
      sukuk: "Sukuk (Bonds)",
    };
    return names[type] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "approved":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "active":
        return "text-green-600 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      case "cancelled":
        return "text-gray-600 bg-gray-50 border-gray-200";
      case "completed":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Building2
                  className="w-8 h-8"
                  style={{ color: primaryColor }}
                />
                Islamic Banking
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage Shariah-compliant financial products
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowApplicationForm(true)}
                className="px-4 py-2 rounded-lg hover:bg-muted flex items-center gap-2"
                style={{ backgroundColor: primaryColor, color: "white" }}
              >
                <Plus className="w-5 h-5" />
                New Application
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
                disabled={loading}
              >
                <Download className="w-5 h-5" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
                disabled={loading}
              >
                <Download className="w-5 h-5" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.approved}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.active}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.rejected}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="container py-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by reference, user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Products</option>
              <option value="murabaha">Murabaha (Cost-Plus)</option>
              <option value="musharaka">Musharaka (Partnership)</option>
              <option value="ijara">Ijara (Leasing)</option>
              <option value="takaful">Takaful (Insurance)</option>
              <option value="sukuk">Sukuk (Bonds)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="container pb-6">
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">
              Islamic Banking Products ({filteredProducts.length})
            </h2>
          </div>

          {loading && products.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Reference</th>
                    <th className="text-left p-4 font-medium">Product Type</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">User ID</th>
                    <th className="text-left p-4 font-medium">Created</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-t border-border hover:bg-muted/30"
                    >
                      <td className="p-4">
                        <div className="font-medium">
                          {product.reference_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {product.id}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getProductIcon(product.product_type)}
                          <span className="capitalize">
                            {getProductTypeName(product.product_type)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(product.status)}`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{product.user_id}</td>
                      <td className="p-4 text-sm">
                        {new Date(product.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectProduct(product)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredProducts.length > limit && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(filteredProducts.length / limit)} ({filteredProducts.length} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-sm border rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                    <button className="px-3 py-1 text-sm border rounded disabled:opacity-50" disabled={page >= Math.ceil(filteredProducts.length / limit)} onClick={() => setPage(p => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {getProductIcon(selectedProduct.product_type)}
                {getProductTypeName(selectedProduct.product_type)} Details
              </h2>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Reference Number
                  </label>
                  <p className="font-medium">
                    {selectedProduct.reference_number}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Status
                  </label>
                  <p>
                    <span
                      className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedProduct.status)}`}
                    >
                      {selectedProduct.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    User ID
                  </label>
                  <p className="font-medium">{selectedProduct.user_id}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Tenant ID
                  </label>
                  <p className="font-medium">{selectedProduct.tenant_id}</p>
                </div>
              </div>

              {/* Product-specific details */}
              {selectedProduct.product_type === "murabaha" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Asset Name
                    </label>
                    <p className="font-medium">
                      {selectedProduct.asset_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Cost Price
                    </label>
                    <p className="font-medium">
                      {selectedProduct.cost_price
                        ? formatCurrency(selectedProduct.cost_price)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Profit Margin
                    </label>
                    <p className="font-medium">
                      {selectedProduct.profit_margin
                        ? `${selectedProduct.profit_margin}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Selling Price
                    </label>
                    <p className="font-medium">
                      {selectedProduct.selling_price
                        ? formatCurrency(selectedProduct.selling_price)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Tenure
                    </label>
                    <p className="font-medium">
                      {selectedProduct.tenure_months
                        ? `${selectedProduct.tenure_months} months`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Monthly Payment
                    </label>
                    <p className="font-medium">
                      {selectedProduct.monthly_payment
                        ? formatCurrency(selectedProduct.monthly_payment)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              {selectedProduct.product_type === "musharaka" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Business Name
                    </label>
                    <p className="font-medium">
                      {selectedProduct.business_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Total Investment
                    </label>
                    <p className="font-medium">
                      {selectedProduct.total_investment
                        ? formatCurrency(selectedProduct.total_investment)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Bank Share
                    </label>
                    <p className="font-medium">
                      {selectedProduct.bank_share
                        ? `${selectedProduct.bank_share}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Customer Share
                    </label>
                    <p className="font-medium">
                      {selectedProduct.customer_share
                        ? `${selectedProduct.customer_share}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Profit Ratio (Bank)
                    </label>
                    <p className="font-medium">
                      {selectedProduct.profit_ratio_bank
                        ? `${selectedProduct.profit_ratio_bank}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Duration
                    </label>
                    <p className="font-medium">
                      {selectedProduct.duration_months
                        ? `${selectedProduct.duration_months} months`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              {selectedProduct.product_type === "ijara" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Asset Name
                    </label>
                    <p className="font-medium">
                      {selectedProduct.asset_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Lease Type
                    </label>
                    <p className="font-medium capitalize">
                      {selectedProduct.lease_type || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Asset Value
                    </label>
                    <p className="font-medium">
                      {selectedProduct.asset_value
                        ? formatCurrency(selectedProduct.asset_value)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Monthly Rental
                    </label>
                    <p className="font-medium">
                      {selectedProduct.monthly_rental
                        ? formatCurrency(selectedProduct.monthly_rental)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Lease Period
                    </label>
                    <p className="font-medium">
                      {selectedProduct.lease_period_months
                        ? `${selectedProduct.lease_period_months} months`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Purchase Option
                    </label>
                    <p className="font-medium">
                      {selectedProduct.purchase_option_price
                        ? formatCurrency(selectedProduct.purchase_option_price)
                        : "None"}
                    </p>
                  </div>
                </div>
              )}

              {selectedProduct.product_type === "takaful" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Policy Type
                    </label>
                    <p className="font-medium capitalize">
                      {selectedProduct.policy_type || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Coverage Amount
                    </label>
                    <p className="font-medium">
                      {selectedProduct.coverage_amount
                        ? formatCurrency(selectedProduct.coverage_amount)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Premium Frequency
                    </label>
                    <p className="font-medium capitalize">
                      {selectedProduct.premium_frequency || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Premium Amount
                    </label>
                    <p className="font-medium">
                      {selectedProduct.premium_amount
                        ? formatCurrency(selectedProduct.premium_amount)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Policy Duration
                    </label>
                    <p className="font-medium">
                      {selectedProduct.policy_duration_months
                        ? `${selectedProduct.policy_duration_months} months`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              {selectedProduct.product_type === "sukuk" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Sukuk Name
                    </label>
                    <p className="font-medium">
                      {selectedProduct.sukuk_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Investment Amount
                    </label>
                    <p className="font-medium">
                      {selectedProduct.investment_amount
                        ? formatCurrency(selectedProduct.investment_amount)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Profit Rate
                    </label>
                    <p className="font-medium">
                      {selectedProduct.expected_profit_rate
                        ? `${selectedProduct.expected_profit_rate}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Maturity Period
                    </label>
                    <p className="font-medium">
                      {selectedProduct.maturity_period_months
                        ? `${selectedProduct.maturity_period_months} months`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Payout Frequency
                    </label>
                    <p className="font-medium capitalize">
                      {selectedProduct.payout_frequency || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Expected Returns
                    </label>
                    <p className="font-medium">
                      {selectedProduct.expected_returns
                        ? formatCurrency(selectedProduct.expected_returns)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <label className="text-sm text-muted-foreground">
                    Created At
                  </label>
                  <p className="font-medium">
                    {new Date(selectedProduct.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Updated At
                  </label>
                  <p className="font-medium">
                    {new Date(selectedProduct.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                {selectedProduct.status === "pending" && (
                  <>
                    <Button
                      onClick={() =>
                        handleStatusChange(
                          selectedProduct.id,
                          selectedProduct.product_type,
                          "approved",
                        )
                      }
                      disabled={processingIds.has(selectedProduct.id)}
                      className="flex-1"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() =>
                        handleStatusChange(
                          selectedProduct.id,
                          selectedProduct.product_type,
                          "rejected",
                        )
                      }
                      disabled={processingIds.has(selectedProduct.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}

                {selectedProduct.status === "approved" && (
                  <Button
                    onClick={() =>
                      handleStatusChange(
                        selectedProduct.id,
                        selectedProduct.product_type,
                        "active",
                      )
                    }
                    disabled={processingIds.has(selectedProduct.id)}
                    className="flex-1"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Activate
                  </Button>
                )}

                {(selectedProduct.status === "pending" ||
                  selectedProduct.status === "approved") && (
                  <Button
                    onClick={() =>
                      handleCancel(
                        selectedProduct.id,
                        selectedProduct.product_type,
                      )
                    }
                    disabled={processingIds.has(selectedProduct.id)}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Islamic Banking Application Form */}
      <IslamicBankingApplicationForm
        open={showApplicationForm}
        onOpenChange={setShowApplicationForm}
        onSuccess={() => {
          fetchAllProducts();
        }}
      />
    </div>
  );
}
