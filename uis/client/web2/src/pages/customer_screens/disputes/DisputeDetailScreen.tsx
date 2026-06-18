import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiArrowLeft, FiMessageSquare, FiRefreshCw, FiSend, FiX } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { disputeService, type Dispute } from '../../../services/dispute_service';

const statusColor = (s: string) => {
  switch (s.toLowerCase()) {
    case 'pending': case 'open': return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
    case 'under_review': return 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
    case 'resolved': return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    case 'rejected': return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    case 'escalated': return 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30';
    default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
  }
};

const priorityColor = (p: string) => {
  if (p === 'high') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  if (p === 'medium') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
};

const categoryLabel: Record<string, string> = {
  unauthorized_transaction: 'Unauthorized Transaction',
  incorrect_amount: 'Incorrect Amount',
  service_not_received: 'Service Not Received',
  duplicate_charge: 'Duplicate Charge',
  other: 'Other',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending', open: 'Open', under_review: 'Under Review',
  resolved: 'Resolved', rejected: 'Rejected', escalated: 'Escalated',
};

const DisputeDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [dispute, setDispute] = useState<Dispute | null>((location.state as { dispute?: Dispute })?.dispute ?? null);
  const [loading, setLoading] = useState(!dispute);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Array<Record<string, unknown>>>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  useEffect(() => {
    if (id) {
      if (!dispute) load(id);
      loadComments(id);
    }
  }, [id]);

  const load = async (disputeId: string) => {
    try {
      setLoading(true);
      setError(null);
      setDispute(await disputeService.getDisputeById(disputeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (disputeId: string) => {
    try {
      setComments(await disputeService.getDisputeComments(disputeId));
    } catch {/* non-fatal */}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !id) return;
    setSubmittingComment(true);
    try {
      await disputeService.addComment(id, commentText.trim());
      setCommentText('');
      loadComments(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !window.confirm('Cancel this dispute?')) return;
    setActionLoading(true);
    try {
      const updated = await disputeService.cancelDispute(id);
      setDispute(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await disputeService.escalateDispute(id, escalateReason);
      setDispute(updated);
      setShowEscalateModal(false);
      setEscalateReason('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to escalate dispute');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin h-12 w-12 border-4 border-red-600 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !dispute) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <p className="text-red-500 mb-4">{error || 'Dispute not found'}</p>
      <button onClick={() => id && load(id)} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg">
        <FiRefreshCw className="w-4 h-4" /><span>Retry</span>
      </button>
    </div>
  );

  const canEscalate = dispute.status === 'pending' || dispute.status === 'under_review';
  const canCancel = dispute.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => navigate('/disputes')} className="p-2 hover:bg-white/10 rounded-full mb-4">
            <FiArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-3">
              <p className="text-white/70 text-sm mb-1">{categoryLabel[dispute.category] || dispute.category}</p>
              <h1 className="text-xl font-bold text-white mb-2">{dispute.subject}</h1>
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(dispute.status)}`}>
                  {statusLabel[dispute.status] || dispute.status}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${priorityColor(dispute.priority)}`}>
                  {dispute.priority.charAt(0).toUpperCase() + dispute.priority.slice(1)} Priority
                </span>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center min-w-[100px]">
              <p className="text-white/70 text-xs">Disputed</p>
              <p className="text-white font-bold text-lg">₦{dispute.disputedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          {[
            { label: 'Dispute ID', value: dispute.id },
            { label: 'Transaction ID', value: dispute.transactionId || '—' },
            { label: 'Category', value: categoryLabel[dispute.category] || dispute.category },
            { label: 'Submitted', value: new Date(dispute.createdAt).toLocaleString() },
            ...(dispute.updatedAt ? [{ label: 'Last Updated', value: new Date(dispute.updatedAt).toLocaleString() }] : []),
            ...(dispute.resolvedAt ? [{ label: 'Resolved', value: new Date(dispute.resolvedAt).toLocaleString() }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{dispute.description}</p>
        </div>

        {/* Resolution Notes */}
        {dispute.resolutionNotes && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
            <h2 className="font-semibold text-green-800 dark:text-green-300 mb-2">Resolution Notes</h2>
            <p className="text-sm text-green-700 dark:text-green-400">{dispute.resolutionNotes}</p>
          </div>
        )}

        {/* Attachments */}
        {dispute.attachments.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Attachments ({dispute.attachments.length})</h2>
            <div className="space-y-2">
              {dispute.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-[var(--primary-color)] hover:opacity-80">
                  <span>📎</span><span className="truncate">Attachment {i + 1}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <FiMessageSquare className="w-4 h-4" /><span>Comments</span>
          </h2>
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">No comments yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((c, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{String(c.comment || c.content || c.text || '')}</p>
                  {Boolean(c.created_at) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(String(c.created_at)).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddComment} className="flex items-center space-x-2">
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button type="submit" disabled={submittingComment || !commentText.trim()}
              className="p-2 bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700">
              <FiSend className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Actions */}
        {(canEscalate || canCancel) && (
          <div className="flex space-x-3">
            {canEscalate && (
              <button onClick={() => setShowEscalateModal(true)} disabled={actionLoading}
                className="flex-1 py-3 border-2 border-orange-500 text-orange-600 dark:text-orange-400 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50">
                <FiAlertTriangle className="w-4 h-4 inline mr-2" />Escalate
              </button>
            )}
            {canCancel && (
              <button onClick={handleCancel} disabled={actionLoading}
                className="flex-1 py-3 border-2 border-red-500 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                <FiX className="w-4 h-4 inline mr-2" />Cancel Dispute
              </button>
            )}
          </div>
        )}
      </div>

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Escalate Dispute</h3>
            <form onSubmit={handleEscalate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Escalation</label>
                <textarea value={escalateReason} onChange={e => setEscalateReason(e.target.value)} rows={3}
                  placeholder="Explain why you're escalating this dispute..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => setShowEscalateModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  {actionLoading ? 'Escalating...' : 'Escalate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeDetailScreen;
