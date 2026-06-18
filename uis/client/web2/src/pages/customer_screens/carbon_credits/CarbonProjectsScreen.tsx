import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';

interface CarbonProject {
  id: string;
  name: string;
  description: string;
  location: string;
  project_type: string;
  status: string;
  total_credits: number;
  available_credits: number;
  price_per_credit: number;
  start_date?: string;
  end_date?: string;
  developer?: string;
  standard?: string;
}

const statusColor = (s: string) => {
  if (s === 'active' || s === 'verified') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'completed') return 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const projectTypeIcon: Record<string, string> = {
  reforestation: '🌳', solar: '☀️', wind: '💨', cookstoves: '🍳', biogas: '♻️', conservation: '🌿', other: '🌍',
};

const CarbonProjectsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CarbonProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investing, setInvesting] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [selectedProject, setSelectedProject] = useState<CarbonProject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.get('/carbon/api/v1/carbon/projects');
      const data = res.data as Record<string, unknown> | unknown[];
      const list = Array.isArray(data) ? data : ((data as Record<string, unknown>).projects || (data as Record<string, unknown>).data || []) as unknown[];
      setProjects(list as CarbonProject[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await apiService.post('/carbon/api/v1/carbon/trades', {
        project_id: selectedProject.id,
        quantity: parseFloat(investAmount),
        trade_type: 'purchase',
      });
      setInvesting(null);
      setInvestAmount('');
      setSelectedProject(null);
      alert('Investment submitted successfully!');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to invest');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-emerald-700 to-green-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/carbon-credits')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Carbon Projects</h1>
                <p className="text-white/70 text-sm">Offset your emissions by investing</p>
              </div>
            </div>
            <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full"></div></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <div className="text-5xl mb-4">🌿</div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Projects Available</p>
            <p>Check back later for carbon offset projects</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projects.map(project => (
              <div key={project.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 flex items-center space-x-3">
                  <span className="text-3xl">{projectTypeIcon[project.project_type?.toLowerCase()] || '🌍'}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{project.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">📍 {project.location}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(project.status)}`}>{project.status}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{project.description}</p>
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                      <p className="text-gray-400 dark:text-gray-500">Price/Credit</p>
                      <p className="font-bold text-gray-900 dark:text-white">₦{(project.price_per_credit || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                      <p className="text-gray-400 dark:text-gray-500">Available</p>
                      <p className="font-bold text-gray-900 dark:text-white">{(project.available_credits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  {project.developer && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Developer: {project.developer}</p>}
                  <button
                    onClick={() => { setSelectedProject(project); setInvesting(project.id); }}
                    disabled={project.status !== 'active' && project.status !== 'verified'}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Invest in Credits
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invest Modal */}
      {investing && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Buy Carbon Credits</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selectedProject.name}</p>
            <form onSubmit={handleInvest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Credits</label>
                <input type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)} required min="1" step="1"
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
                {investAmount && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total: ₦{(parseFloat(investAmount || '0') * (selectedProject.price_per_credit || 0)).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => { setInvesting(null); setInvestAmount(''); setSelectedProject(null); }}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold disabled:opacity-50">
                  {submitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarbonProjectsScreen;
