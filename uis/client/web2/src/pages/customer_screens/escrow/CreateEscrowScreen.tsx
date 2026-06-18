import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateEscrowScreen.css';

interface AdditionalParty {
  id: string;
  role: string;
  name: string;
  email: string;
  splitPercentage: string;
}

const ADDITIONAL_ROLES = ['agent', 'arbitrator', 'logistics', 'inspector'];

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agent',
  arbitrator: 'Arbitrator',
  logistics: 'Logistics Provider',
  inspector: 'Inspector',
};

const CreateEscrowScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('Property Transaction');
  const [additionalParties, setAdditionalParties] = useState<AdditionalParty[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    buyerName: '',
    buyerEmail: '',
    sellerName: '',
    sellerEmail: '',
    sellerAccountNumber: '',
    sellerBank: '',
    conditions: '',
    description: '',
  });

  const escrowTypes = ['Property Transaction', 'Service Payment', 'Contract Deposit'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addParty = () => {
    setAdditionalParties(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'agent', name: '', email: '', splitPercentage: '' },
    ]);
  };

  const removeParty = (id: string) => {
    setAdditionalParties(prev => prev.filter(p => p.id !== id));
  };

  const updateParty = (id: string, field: keyof Omit<AdditionalParty, 'id'>, value: string) => {
    setAdditionalParties(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData.id;

      if (!userId) {
        throw new Error('No valid local user found');
      }

      const parties: Record<string, unknown>[] = [
        {
          role: 'buyer',
          name: formData.buyerName,
          email: formData.buyerEmail,
        },
        {
          role: 'seller',
          name: formData.sellerName,
          email: formData.sellerEmail,
          account_number: formData.sellerAccountNumber,
          bank_code: formData.sellerBank,
        },
      ];

      for (const p of additionalParties) {
        if (!p.name.trim()) continue;
        const party: Record<string, unknown> = {
          role: p.role,
          name: p.name,
          email: p.email,
        };
        if (p.splitPercentage) {
          const pct = parseFloat(p.splitPercentage);
          if (!isNaN(pct)) party.split_percentage = pct;
        }
        parties.push(party);
      }

      const payload = {
        title: formData.title,
        type: selectedType,
        use_case: 'freelance',
        total_amount: parseFloat(formData.amount),
        currency: 'NGN',
        description: formData.description,
        release_conditions: formData.conditions,
        user_id: userId,
        parties,
      };

      const { escrowService } = await import('../../../services/escrow_service');
      await escrowService.createEscrow(payload);

      alert('Escrow created successfully!');
      navigate(-1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      alert(err.response?.data?.error || err.message || 'Failed to create escrow');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-escrow-screen">
      <div className="escrow-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Create Escrow</h1>
      </div>

      <form className="escrow-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Escrow Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter escrow title"
            required
          />
        </div>

        <div className="form-group">
          <label>Escrow Type</label>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {escrowTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Total Amount (₦)</label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="Enter amount"
            required
            min="1"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe the escrow agreement"
            rows={3}
            required
          />
        </div>

        <div className="form-group">
          <label>Release Conditions</label>
          <textarea
            name="conditions"
            value={formData.conditions}
            onChange={handleChange}
            placeholder="Specify conditions for releasing funds"
            rows={3}
            required
          />
        </div>

        <h2>Buyer Information</h2>
        <div className="form-group">
          <label>Buyer Name</label>
          <input
            type="text"
            name="buyerName"
            value={formData.buyerName}
            onChange={handleChange}
            placeholder="Enter buyer name"
            required
          />
        </div>

        <div className="form-group">
          <label>Buyer Email</label>
          <input
            type="email"
            name="buyerEmail"
            value={formData.buyerEmail}
            onChange={handleChange}
            placeholder="Enter buyer email"
            required
          />
        </div>

        <h2>Seller Information</h2>
        <div className="form-group">
          <label>Seller Name</label>
          <input
            type="text"
            name="sellerName"
            value={formData.sellerName}
            onChange={handleChange}
            placeholder="Enter seller name"
            required
          />
        </div>

        <div className="form-group">
          <label>Seller Email</label>
          <input
            type="email"
            name="sellerEmail"
            value={formData.sellerEmail}
            onChange={handleChange}
            placeholder="Enter seller email"
            required
          />
        </div>

        <div className="form-group">
          <label>Seller Account Number</label>
          <input
            type="text"
            name="sellerAccountNumber"
            value={formData.sellerAccountNumber}
            onChange={handleChange}
            placeholder="Enter account number"
            required
          />
        </div>

        <div className="form-group">
          <label>Seller Bank Code</label>
          <input
            type="text"
            name="sellerBank"
            value={formData.sellerBank}
            onChange={handleChange}
            placeholder="Enter bank code"
            required
          />
        </div>

        {/* Additional Parties */}
        <div className="section-header">
          <h2>Additional Parties</h2>
          <button type="button" className="add-party-btn" onClick={addParty}>
            + Add Party
          </button>
        </div>
        {additionalParties.length === 0 && (
          <p className="helper-text">
            Optionally add agents, arbitrators, logistics providers, or inspectors.
          </p>
        )}
        {additionalParties.map((party, index) => (
          <div key={party.id} className="party-card">
            <div className="party-card-header">
              <span>Party {index + 1}</span>
              <button type="button" className="remove-party-btn" onClick={() => removeParty(party.id)}>
                ✕
              </button>
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={party.role} onChange={(e) => updateParty(party.id, 'role', e.target.value)}>
                {ADDITIONAL_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={party.name}
                onChange={(e) => updateParty(party.id, 'name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label>Email (optional)</label>
              <input
                type="email"
                value={party.email}
                onChange={(e) => updateParty(party.id, 'email', e.target.value)}
                placeholder="Email address"
              />
            </div>
            <div className="form-group">
              <label>Split % (optional)</label>
              <input
                type="number"
                value={party.splitPercentage}
                onChange={(e) => updateParty(party.id, 'splitPercentage', e.target.value)}
                placeholder="e.g. 5"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>
        ))}

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? 'Creating Escrow...' : 'Create Escrow'}
        </button>
      </form>
    </div>
  );
};

export default CreateEscrowScreen;
