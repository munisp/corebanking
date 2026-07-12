import React, { useEffect, useState } from 'react';
import '../../../App.css';
import { useAuth } from '../../../contexts/AuthContext';
import type { Cheque } from '../../../services/cheque_service';
import { chequeService } from '../../../services/cheque_service';

const ChequesScreen: React.FC = () => {
  const { user } = useAuth();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  // Request form state
  const [numberOfLeaves, setNumberOfLeaves] = useState<number>(25);
  const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'branch'>('courier');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    loadCheques();
  }, []);

  const loadCheques = async () => {
    try {
      setLoading(true);
      const data = await chequeService.getCheques();
      setCheques(data);
    } catch (error) {
      console.error('Failed to load cheques:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChequeBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setRequestLoading(true);
      const result = await chequeService.requestChequeBook({
        accountId: user.id,
        numberOfLeaves,
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'courier' ? deliveryAddress : undefined,
        branchName: deliveryMethod === 'branch' ? branchName : undefined,
      });

      if (result.success) {
        alert(result.message);
        setShowRequestModal(false);
        loadCheques();
        // Reset form
        setNumberOfLeaves(25);
        setDeliveryMethod('courier');
        setDeliveryAddress('');
        setBranchName('');
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to request cheque book');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleStopCheque = async (chequeId: string) => {
    const reason = window.prompt('Please provide a reason for stopping this cheque:');
    if (!reason) return;

    try {
      const result = await chequeService.stopCheque(chequeId, reason);
      if (result.success) {
        alert(result.message);
        loadCheques();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to stop cheque');
    }
  };

  const getStatusColor = (status: Cheque['status']) => {
    switch (status) {
      case 'requested':
        return '#FFA500';
      case 'issued':
        return '#4CAF50';
      case 'delivered':
        return '#2196F3';
      case 'used':
        return '#9E9E9E';
      case 'stopped':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading cheques...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Cheques</h1>
        <button
          onClick={() => setShowRequestModal(true)}
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
          Request Cheque Book
        </button>
      </div>

      {cheques.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No cheques found. Request a cheque book to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {cheques.map((cheque) => (
            <div
              key={cheque.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                    Cheque #{cheque.chequeNumber}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Leaves: {cheque.numberOfLeaves}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Delivery: {cheque.deliveryMethod === 'courier' ? 'Courier' : 'Branch Pickup'}
                  </p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>
                    Requested: {new Date(cheque.requestDate).toLocaleDateString()}
                  </p>
                  {cheque.issueDate && (
                    <p style={{ color: '#666', marginBottom: '4px' }}>
                      Issued: {new Date(cheque.issueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: 'white',
                      backgroundColor: getStatusColor(cheque.status),
                      marginBottom: '12px',
                    }}
                  >
                    {cheque.status.toUpperCase()}
                  </span>
                  {(cheque.status === 'requested' || cheque.status === 'issued' || cheque.status === 'delivered') && (
                    <div>
                      <button
                        onClick={() => handleStopCheque(cheque.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        Stop Cheque
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Cheque Book Modal */}
      {showRequestModal && (
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
          onClick={() => setShowRequestModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Request Cheque Book</h2>
            <form onSubmit={handleRequestChequeBook}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Number of Leaves
                </label>
                <select
                  value={numberOfLeaves}
                  onChange={(e) => setNumberOfLeaves(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                  }}
                >
                  <option value={25}>25 leaves</option>
                  <option value={50}>50 leaves</option>
                  <option value={100}>100 leaves</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Delivery Method
                </label>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="courier"
                      checked={deliveryMethod === 'courier'}
                      onChange={(e) => setDeliveryMethod(e.target.value as 'courier')}
                      style={{ marginRight: '8px' }}
                    />
                    Courier
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="branch"
                      checked={deliveryMethod === 'branch'}
                      onChange={(e) => setDeliveryMethod(e.target.value as 'branch')}
                      style={{ marginRight: '8px' }}
                    />
                    Branch Pickup
                  </label>
                </div>

                {deliveryMethod === 'courier' && (
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter delivery address"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '16px',
                      minHeight: '80px',
                      resize: 'vertical',
                    }}
                  />
                )}

                {deliveryMethod === 'branch' && (
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="Enter branch name"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '16px',
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
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
                  disabled={requestLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: requestLoading ? '#cccccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: requestLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                  }}
                >
                  {requestLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChequesScreen;
