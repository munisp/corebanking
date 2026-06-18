import React, { useState, useEffect, useCallback } from 'react';
import {
  accountsApi,
  journalEntriesApi,
  type Account,
  type JournalEntry,
} from '../../api/chartOfAccountsApi';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#F3F4F6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E5E7EB',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1F2937',
    margin: 0,
  } as React.CSSProperties,
  content: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  } as React.CSSProperties,
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1F2937',
    margin: 0,
  } as React.CSSProperties,
  cardBody: {
    padding: '20px',
  } as React.CSSProperties,
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  } as React.CSSProperties,
  formGroup: {
    marginBottom: '16px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#FFFFFF',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  primaryButton: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
  } as React.CSSProperties,
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,
  successButton: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
  } as React.CSSProperties,
  dangerButton: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,
  th: {
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: '#F9FAFB',
  } as React.CSSProperties,
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#1F2937',
    borderBottom: '1px solid #E5E7EB',
  } as React.CSSProperties,
  lineInput: {
    padding: '8px 10px',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  totalsRow: {
    backgroundColor: '#F9FAFB',
    fontWeight: 600,
  } as React.CSSProperties,
  balanceIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '16px',
  } as React.CSSProperties,
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  } as React.CSSProperties,
  entryList: {
    marginTop: '24px',
  } as React.CSSProperties,
};

const formatCurrency = (amount: number): string => {
  return `₦${Math.abs(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

interface JournalLineInput {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

export const JournalEntryForm: React.FC<{ tenantId?: string }> = ({ tenantId = 'default' }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<JournalLineInput[]>([
    { id: '1', accountId: '', debit: '', credit: '', description: '' },
    { id: '2', accountId: '', debit: '', credit: '', description: '' },
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, entriesRes] = await Promise.all([
        accountsApi.listAccounts(tenantId),
        journalEntriesApi.listJournalEntries(tenantId),
      ]);
      setAccounts(accountsRes);
      setEntries(entriesRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addLine = () => {
    setLines([
      ...lines,
      { id: String(Date.now()), accountId: '', debit: '', credit: '', description: '' },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((line) => line.id !== id));
  };

  const updateLine = (id: string, field: keyof JournalLineInput, value: string) => {
    setLines(
      lines.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };
        if (field === 'debit' && value) {
          updated.credit = '';
        } else if (field === 'credit' && value) {
          updated.debit = '';
        }
        return updated;
      })
    );
  };

  const totalDebits = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Journal entry must be balanced (debits = credits)');
      return;
    }

    const validLines = lines.filter((line) => line.accountId && (line.debit || line.credit));
    if (validLines.length < 2) {
      alert('At least two lines are required');
      return;
    }

    setSubmitting(true);
    try {
      const entryLines = validLines.map((line) => ({
        account_id: line.accountId,
        debit_amount: parseFloat(line.debit) || 0,
        credit_amount: parseFloat(line.credit) || 0,
        description: line.description,
      }));

      await journalEntriesApi.createJournalEntry({
        date: entryDate,
        description,
        reference,
        lines: entryLines,
      }, tenantId);

      setDescription('');
      setReference('');
      setLines([
        { id: '1', accountId: '', debit: '', credit: '', description: '' },
        { id: '2', accountId: '', debit: '', credit: '', description: '' },
      ]);
      loadData();
      alert('Journal entry created successfully');
    } catch (error) {
      console.error('Failed to create journal entry:', error);
      alert('Failed to create journal entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePost = async (entryId: string) => {
    try {
      await journalEntriesApi.reverseJournalEntry(entryId, "User reversal", tenantId);
      loadData();
    } catch (error) {
      console.error('Failed to post entry:', error);
      alert('Failed to post journal entry');
    }
  };

  const handleReverse = async (entryId: string) => {
    const reason = prompt('Enter reason for reversal:');
    if (!reason) return;
    try {
      await journalEntriesApi.reverseJournalEntry(entryId, reason, tenantId);
      loadData();
    } catch (error) {
      console.error('Failed to reverse entry:', error);
      alert('Failed to reverse journal entry');
    }
  };

  const getAccountName = (accountId: string): string => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Journal Entries</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>New Journal Entry</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={styles.cardBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date *</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Reference</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description *</label>
                <textarea
                  style={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this journal entry"
                  required
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '40%' }}>Account</th>
                      <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>Debit</th>
                      <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>Credit</th>
                      <th style={{ ...styles.th, width: '15%' }}>Memo</th>
                      <th style={{ ...styles.th, width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td style={styles.td}>
                          <select
                            style={styles.lineInput}
                            value={line.accountId}
                            onChange={(e) => updateLine(line.id, 'accountId', e.target.value)}
                          >
                            <option value="">Select Account</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            style={{ ...styles.lineInput, textAlign: 'right' }}
                            value={line.debit}
                            onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            style={{ ...styles.lineInput, textAlign: 'right' }}
                            value={line.credit}
                            onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td style={styles.td}>
                          <input
                            type="text"
                            style={styles.lineInput}
                            value={line.description}
                            onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                            placeholder="Optional"
                          />
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#EF4444',
                              cursor: lines.length <= 2 ? 'not-allowed' : 'pointer',
                              fontSize: '18px',
                              opacity: lines.length <= 2 ? 0.5 : 1,
                            }}
                            onClick={() => removeLine(line.id)}
                            disabled={lines.length <= 2}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr style={styles.totalsRow}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>TOTALS</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(totalDebits)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(totalCredits)}
                      </td>
                      <td colSpan={2} style={styles.td}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={addLine}
                >
                  + Add Line
                </button>

                <div
                  style={{
                    ...styles.balanceIndicator,
                    backgroundColor: isBalanced ? '#D1FAE5' : '#FEE2E2',
                    color: isBalanced ? '#10B981' : '#EF4444',
                  }}
                >
                  {isBalanced ? (
                    <span>Entry is balanced</span>
                  ) : (
                    <span>
                      Out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => {
                  setDescription('');
                  setReference('');
                  setLines([
                    { id: '1', accountId: '', debit: '', credit: '', description: '' },
                    { id: '2', accountId: '', debit: '', credit: '', description: '' },
                  ]);
                }}
              >
                Clear
              </button>
              <button
                type="submit"
                style={{ ...styles.button, ...styles.primaryButton }}
                disabled={!isBalanced || submitting}
              >
                {submitting ? 'Creating...' : 'Create Entry'}
              </button>
            </div>
          </form>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Recent Journal Entries</h3>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>{entries.length} entries</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Entry #</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                      Loading...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                      No journal entries found.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const entryTotal = entry.lines.reduce((sum, line) => sum + line.debit_amount, 0);
                    return (
                      <tr key={entry.id}>
                        <td style={styles.td}>{entry.entry_number}</td>
                        <td style={styles.td}>{new Date(entry.date).toLocaleDateString()}</td>
                        <td style={styles.td}>
                          <div>{entry.description}</div>
                          {entry.reference && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>Ref: {entry.reference}</div>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(entryTotal)}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              backgroundColor:
                                entry.status === 'posted' ? '#D1FAE5' :
                                entry.status === 'reversed' ? '#FEE2E2' : '#FEF3C7',
                              color:
                                entry.status === 'posted' ? '#10B981' :
                                entry.status === 'reversed' ? '#EF4444' : '#F59E0B',
                            }}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {entry.status === 'draft' && (
                              <button
                                style={{ ...styles.button, ...styles.successButton, padding: '4px 8px', fontSize: '12px' }}
                                onClick={() => handlePost(entry.id)}
                              >
                                Post
                              </button>
                            )}
                            {entry.status === 'posted' && (
                              <button
                                style={{ ...styles.button, ...styles.dangerButton, padding: '4px 8px', fontSize: '12px' }}
                                onClick={() => handleReverse(entry.id)}
                              >
                                Reverse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryForm;
