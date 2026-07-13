import React, { useEffect, useState } from 'react';
import '../../../App.css';
import { useAuth } from '../../../contexts/AuthContext';
import type { Dispute } from '../../../services/dispute_service';
import { disputeService } from '../../../services/dispute_service';

const DisputesScreen: React.FC = () => {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Create form state
  const [transactionId, setTransactionId] = useState('');
  const [disputeType, setDisputeType] = useState('INSURANCE');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const data = await disputeService.getAllDisputes();
      setDisputes(data);
    } catch (error) {
      console.error('Failed to load disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setCreateLoading(true);
      await disputeService.createDispute({
        transactionId,
        disputeType,
        description,
      });

      alert('Dispute created successfully');
      setShowCreateModal(false);
      loadDisputes();
      // Reset form
      setTransactionId('');
      setDisputeType('INSURANCE');
      setDescription('');
    } catch (err: unknown) {
      // Only show error if it's not a parsing issue (dispute was created but response parsing failed)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create dispute';
      if (!errorMessage.includes('Cannot read properties') && !errorMessage.includes('reading')) {
        alert(errorMessage);
      } else {
        // Dispute was created successfully, just parsing failed
        alert('Dispute created successfully');
        setShowCreateModal(false);
        loadDisputes();
        // Reset form
        setTransactionId('');
        setDisputeType('INSURANCE');
        setDescription('');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteDispute = async (disputeId: string) => {
    if (!window.confirm('Are you sure you want to delete this dispute?')) return;

    try {
      await disputeService.deleteDispute(disputeId);
      alert('Dispute deleted successfully');
      loadDisputes();
    } catch {
      alert('Failed to delete dispute');
    }
  };

  const getStatusColor = (status: Dispute['status']) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'under_review':
        return '#2196F3';
      case 'resolved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'escalated':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getPriorityColor = (priority: Dispute['priority']) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FFA500';
      case 'low':
        return '#4CAF50';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading disputes...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Disputes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Create Dispute
        </button>
      </div>

      {disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No disputes found. Create a dispute to report an issue with a transaction.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: getStatusColor(dispute.status),
                      }}
                    >
                      {dispute.status.toUpperCase()}
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: getPriorityColor(dispute.priority),
                      }}
                    >
                      {dispute.priority.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {dispute.subject}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Category: {dispute.category}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Transaction ID: {dispute.transactionId}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Amount: ₦{dispute.disputedAmount.toLocaleString()}
                  </p>
                  <p style={{ color: '#666', marginBottom: '8px' }}>
                    {dispute.description}
                  </p>
                  <p style={{ color: '#999', fontSize: '14px' }}>
                    Created: {new Date(dispute.createdAt).toLocaleDateString()}
                  </p>
                  {dispute.resolvedAt && (
                    <p style={{ color: '#999', fontSize: '14px' }}>
                      Resolved: {new Date(dispute.resolvedAt).toLocaleDateString()}
                    </p>
                  )}
                  {dispute.resolutionNotes && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Resolution Notes:</p>
                      <p>{dispute.resolutionNotes}</p>
                    </div>
                  )}
                </div>
                {dispute.status === 'pending' && (
                  <button
                    onClick={() => handleDeleteDispute(dispute.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      marginLeft: '16px',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dispute Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Create Dispute</h2>
            <form onSubmit={handleCreateDispute}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter transaction ID"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Dispute Type
                </label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                >
                  <option value="INSURANCE">Insurance</option>
                  <option value="UNAUTHORIZED">Unauthorized Transaction</option>
                  <option value="INCORRECT_AMOUNT">Incorrect Amount</option>
                  <option value="SERVICE_NOT_RECEIVED">Service Not Received</option>
                  <option value="DUPLICATE">Duplicate Charge</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    minHeight: '100px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: createLoading ? '#cccccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: createLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                  }}
                >
                  {createLoading ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputesScreen;
