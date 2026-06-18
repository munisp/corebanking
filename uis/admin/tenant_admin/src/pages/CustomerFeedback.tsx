import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import {
    type Feedback,
    type FeedbackCategory,
    type FeedbackStatus,
    type FeedbackSummary,
    getFeedbackSummary,
    listFeedback,
    respondToFeedback,
} from "@/services/feedbackService";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Eye,
    MessageSquare,
    RefreshCw,
    Search,
    Star,
    ThumbsUp,
    TrendingUp,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_ICONS: Record<FeedbackStatus, React.ReactNode> = {
  open: <AlertTriangle className="w-3 h-3" />,
  in_progress: <Clock className="w-3 h-3" />,
  resolved: <CheckCircle className="w-3 h-3" />,
  closed: <XCircle className="w-3 h-3" />,
};

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General",
  bug: "Bug Report",
  feature_request: "Feature Request",
  complaint: "Complaint",
  compliment: "Compliment",
  support: "Support",
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}
    >
      {STATUS_ICONS[status]}
      {status.replace("_", " ")}
    </span>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-gray-400 text-xs">No rating</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </span>
  );
}

// ─── component ──────────────────────────────────────────────────────────────

export default function CustomerFeedback() {
  const { primaryColor } = useTenantBranding();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Detail / respond modal
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null,
  );
  const [showModal, setShowModal] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] =
    useState<FeedbackStatus>("resolved");
  const [responding, setResponding] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // ── data fetching ─────────────────────────────────────────────────────────

  const fetchFeedbacks = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await listFeedback({
        status:
          statusFilter !== "all" ? (statusFilter as FeedbackStatus) : undefined,
        category:
          categoryFilter !== "all"
            ? (categoryFilter as FeedbackCategory)
            : undefined,
        page,
        limit,
      });
      setFeedbacks(res.feedbacks ?? []);
      setTotal(res.total ?? res.feedbacks?.length ?? 0);
    } catch (err: any) {
      console.error("Error fetching feedback:", err);
      if (showLoader) toast.error("Failed to load feedback");
      setFeedbacks([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await getFeedbackSummary();
      setSummary(res.summary);
    } catch (err) {
      console.error("Error fetching feedback summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter]);

  useEffect(() => {
    fetchFeedbacks(true);
    fetchSummary();
    const interval = setInterval(() => {
      fetchFeedbacks(false);
      fetchSummary();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, page]);

  // ── respond ───────────────────────────────────────────────────────────────

  const handleRespond = async () => {
    if (!selectedFeedback) return;
    if (!responseText.trim()) {
      toast.error("Please enter a response message");
      return;
    }
    setResponding(true);
    try {
      const res = await respondToFeedback(selectedFeedback.id, {
        response: responseText,
        status: responseStatus,
      });
      setSelectedFeedback(res.feedback);
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === res.feedback.id ? res.feedback : f)),
      );
      toast.success("Response submitted successfully");
      setResponseText("");
      fetchSummary();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to submit response";
      toast.error(msg);
    } finally {
      setResponding(false);
    }
  };

  const openModal = (fb: Feedback) => {
    setSelectedFeedback(fb);
    setResponseText("");
    setResponseStatus("resolved");
    setShowModal(true);
  };

  // ── filter client-side by search ─────────────────────────────────────────

  const filtered = feedbacks.filter((fb) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      fb.subject.toLowerCase().includes(q) ||
      fb.message.toLowerCase().includes(q) ||
      fb.category.toLowerCase().includes(q)
    );
  });

  // ── summary cards ─────────────────────────────────────────────────────────

  const statCards = [
    {
      label: "Total Feedback",
      value: summaryLoading ? "—" : (summary?.total ?? 0),
      icon: <MessageSquare className="w-5 h-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Open",
      value: summaryLoading ? "—" : (summary?.by_status?.open ?? 0),
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Resolved",
      value: summaryLoading ? "—" : (summary?.by_status?.resolved ?? 0),
      icon: <CheckCircle className="w-5 h-5" />,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Avg. Rating",
      value: summaryLoading
        ? "—"
        : summary?.average_rating != null
          ? `${summary.average_rating} / 5`
          : "N/A",
      icon: <Star className="w-5 h-5" />,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background">
      <div className="container py-8">
        <PageHeader
          label="Customer Feedback"
          title="Customer Feedback"
          description="Review and respond to customer feedback submissions"
          icon={<MessageSquare className="w-8 h-8" />}
          action={{
            label: "Refresh",
            onClick: () => {
              fetchFeedbacks(true);
              fetchSummary();
            }
          }}
        />
      </div>

      <div className="container py-8">
        {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
          >
            <div className={`${card.bg} ${card.color} p-2 rounded-lg`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {summary && !summaryLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              By Category
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.by_category).map(([cat, count]) => (
              <div
                key={cat}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
              >
                <span className="text-xs font-medium text-gray-700">
                  {CATEGORY_LABELS[cat as FeedbackCategory] ?? cat}
                </span>
                <span className="text-xs bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 font-semibold">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by subject or message…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="bug">Bug Report</SelectItem>
            <SelectItem value="feature_request">Feature Request</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="compliment">Compliment</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading feedback…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No feedback found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Subject
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rating
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Submitted
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((fb) => (
                <tr key={fb.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[240px]">
                      {fb.subject}
                    </p>
                    <p className="text-gray-400 text-xs truncate max-w-[240px]">
                      {fb.message}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[fb.category] ?? fb.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RatingStars rating={fb.rating} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={fb.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(fb.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                      onClick={() => openModal(fb)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / limit)} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / Respond Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback Details
            </DialogTitle>
            <DialogDescription>
              Review the customer's feedback and submit a response.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* Meta row */}
              <div className="flex flex-wrap gap-2 items-center">
                <StatusBadge status={selectedFeedback.status} />
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[selectedFeedback.category] ??
                    selectedFeedback.category}
                </Badge>
                <RatingStars rating={selectedFeedback.rating} />
              </div>

              {/* Subject + message */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <p className="font-semibold text-gray-900">
                  {selectedFeedback.subject}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {selectedFeedback.message}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Submitted{" "}
                  {new Date(selectedFeedback.created_at).toLocaleString(
                    "en-GB",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                    },
                  )}
                </p>
              </div>

              {/* Existing response */}
              {selectedFeedback.response && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold mb-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Response already submitted
                  </div>
                  <p className="text-sm text-gray-700">
                    {selectedFeedback.response}
                  </p>
                  {selectedFeedback.responded_at && (
                    <p className="text-xs text-gray-400">
                      Responded{" "}
                      {new Date(selectedFeedback.responded_at).toLocaleString(
                        "en-GB",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Respond form — only if not closed */}
              {selectedFeedback.status !== "closed" && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Label className="text-sm font-medium">
                    {selectedFeedback.response
                      ? "Update Response"
                      : "Write a Response"}
                  </Label>
                  <Textarea
                    placeholder="Type your response to the customer…"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-sm shrink-0">Update Status To</Label>
                    <Select
                      value={responseStatus}
                      onValueChange={(v) =>
                        setResponseStatus(v as FeedbackStatus)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Close
            </Button>
            {selectedFeedback && selectedFeedback.status !== "closed" && (
              <Button
                onClick={handleRespond}
                disabled={responding || !responseText.trim()}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                {responding ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                )}
                {responding ? "Submitting…" : "Submit Response"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
