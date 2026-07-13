import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EsusuGroup } from '../../../models/esusu';
import { esusuService } from '../../../services/esusu_service';
import './EsusuScreen.css';

type TabType = 'my-groups' | 'discover';

interface EsusuStats {
  myGroups: number;
  myContributions: number;
  myPayouts: number;
}

interface EsusuContribution {
  id: string;
  memberName: string;
  amount: number;
  round: number;
  date: string;
}

interface EsusuMember {
  id: string;
  fullName: string;
  position: number;
  hasReceivedPayout: boolean;
}

const EsusuScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('my-groups');
  const [stats, setStats] = useState<EsusuStats>({
    myGroups: 0,
    myContributions: 0,
    myPayouts: 0,
  });
  const [myGroups, setMyGroups] = useState<EsusuGroup[]>([]);
  const [availableGroups, setAvailableGroups] = useState<EsusuGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<EsusuGroup | null>(null);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load my groups and available groups - matching mobile API calls exactly
      const myGroupsData = await esusuService.getGroups(true); // my_groups=true
      const availableGroupsData = await esusuService.getGroups(false, 'active'); // status=active
      
      // Calculate stats from groups like mobile does
      let myContributions = 0;
      let myPayouts = 0;
      let activeGroupsCount = 0;
      
      for (const group of myGroupsData) {
        if (group.status === 'active') {
          activeGroupsCount++;
        }
      }
      
      setMyGroups(myGroupsData);
      setAvailableGroups(availableGroupsData);
      setStats({
        myGroups: myGroupsData.length,
        myContributions: myContributions,
        myPayouts: myPayouts,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load esusu data');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      await esusuService.joinGroup(groupId);
      loadData();
      alert('Successfully joined group');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      alert(errorMessage);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#ff9800';
      case 'active':
        return '#4caf50';
      case 'completed':
        return '#2196f3';
      case 'cancelled':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(1)}K`;
    }
    return `₦${amount.toFixed(0)}`;
  };

  const handleViewDetails = (group: EsusuGroup) => {
    setSelectedGroup(group);
    setShowGroupDetails(true);
  };

  if (loading) {
    return (
      <div className="esusu-screen loading">
        <div className="spinner"></div>
        <p>Loading Esusu groups...</p>
      </div>
    );
  }

  return (
    <div className="esusu-screen">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Esusu</h1>
        <div className="header-actions">
          <button className="refresh-button" onClick={loadData} title="Refresh">
            🔄
          </button>
          <button className="create-button" onClick={() => setShowCreateDialog(true)}>
            + Create
          </button>
        </div>
      </div>

      <div className="stats-card">
        <div className="stat-item">
          <div className="stat-value">{stats.myGroups}</div>
          <div className="stat-label">My Groups</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{formatCurrency(stats.myContributions)}</div>
          <div className="stat-label">Contributed</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{formatCurrency(stats.myPayouts)}</div>
          <div className="stat-label">Received</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'my-groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-groups')}
        >
          My Groups
        </button>
        <button
          className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
      </div>

      <div className="content">
        {error && (
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <div className="error-text">
              <p>{error}</p>
              <button onClick={loadData}>Retry</button>
            </div>
          </div>
        )}

        {activeTab === 'my-groups' ? (
          <MyGroupsTab 
            groups={myGroups} 
            onViewDetails={handleViewDetails}
            formatCurrency={formatCurrency}
            getStatusColor={getStatusColor}
          />
        ) : (
          <DiscoverTab 
            groups={availableGroups} 
            onJoinGroup={handleJoinGroup}
            formatCurrency={formatCurrency}
            getStatusColor={getStatusColor}
          />
        )}
      </div>

      {showCreateDialog && (
        <CreateGroupDialog 
          onClose={() => setShowCreateDialog(false)} 
          onSuccess={() => {
            setShowCreateDialog(false);
            loadData();
          }}
        />
      )}

      {showGroupDetails && selectedGroup && (
        <GroupDetailsModal
          group={selectedGroup}
          onClose={() => setShowGroupDetails(false)}
          onContributionMade={() => loadData()}
        />
      )}
    </div>
  );
};

interface GroupsTabProps {
  groups: EsusuGroup[];
  onViewDetails?: (group: EsusuGroup) => void;
  onJoinGroup?: (groupId: string) => void;
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: string) => string;
}

const MyGroupsTab: React.FC<GroupsTabProps> = ({ groups, onViewDetails, formatCurrency, getStatusColor }) => {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h3>No groups yet</h3>
        <p>Create or join an Esusu group to get started</p>
      </div>
    );
  }

  return (
    <div className="groups-list">
      {groups.map(group => (
        <GroupCard 
          key={group.id} 
          group={group} 
          isMyGroup={true}
          onViewDetails={onViewDetails}
          formatCurrency={formatCurrency}
          getStatusColor={getStatusColor}
        />
      ))}
    </div>
  );
};

const DiscoverTab: React.FC<GroupsTabProps> = ({ groups, onJoinGroup, formatCurrency, getStatusColor }) => {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>No groups available</h3>
        <p>Check back later for new groups</p>
      </div>
    );
  }

  return (
    <div className="groups-list">
      {groups.map(group => (
        <GroupCard 
          key={group.id} 
          group={group} 
          isMyGroup={false}
          onJoinGroup={onJoinGroup}
          formatCurrency={formatCurrency}
          getStatusColor={getStatusColor}
        />
      ))}
    </div>
  );
};

interface GroupCardProps {
  group: EsusuGroup;
  isMyGroup: boolean;
  onViewDetails?: (group: EsusuGroup) => void;
  onJoinGroup?: (groupId: string) => void;
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: string) => string;
}

const GroupCard: React.FC<GroupCardProps> = ({ 
  group, 
  isMyGroup, 
  onViewDetails, 
  onJoinGroup,
  formatCurrency,
  getStatusColor 
}) => {
  const progress = group.totalMembers > 0 ? (group.cycleNumber / group.totalMembers) * 100 : 0;

  return (
    <div className="group-card">
      <div className="group-header">
        <h3>{group.name}</h3>
        <span 
          className="status-badge" 
          style={{ backgroundColor: `${getStatusColor(group.status)}20`, color: getStatusColor(group.status) }}
        >
          {group.status.toUpperCase()}
        </span>
      </div>

      {group.description && (
        <p className="group-description">{group.description}</p>
      )}

      <div className="group-stats">
        <div className="stat">
          <div className="stat-label">Contribution</div>
          <div className="stat-value">{formatCurrency(group.contributionAmount)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Frequency</div>
          <div className="stat-value">{group.frequency}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Members</div>
          <div className="stat-value">{group.currentMembers}/{group.totalMembers}</div>
        </div>
      </div>

      <div className="group-progress">
        <div className="progress-label">Round {group.cycleNumber}/{group.totalMembers}</div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%`, backgroundColor: getStatusColor(group.status) }}
          ></div>
        </div>
      </div>

      <div className="group-footer">
        <div className="creator-info">Created by {group.creatorName || 'Unknown'}</div>
        {isMyGroup && onViewDetails ? (
          <button className="view-details-btn" onClick={() => onViewDetails(group)}>
            View Details
          </button>
        ) : (
          group.currentMembers < group.totalMembers && onJoinGroup && (
            <button className="join-btn" onClick={() => onJoinGroup(group.id)}>
              Join
            </button>
          )
        )}
      </div>
    </div>
  );
};

interface CreateGroupDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    maxMembers: '',
    frequency: 'monthly',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.contributionAmount || !formData.maxMembers) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Match mobile API call structure exactly
      await esusuService.createGroup({
        name: formData.name,
        description: formData.description || undefined,
        contributionAmount: parseFloat(formData.contributionAmount),
        frequency: formData.frequency as 'daily' | 'weekly' | 'monthly',
        maxMembers: parseInt(formData.maxMembers),
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });
      alert('Group created successfully');
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create Esusu Group</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Contribution Amount (₦) *</label>
            <input
              type="number"
              value={formData.contributionAmount}
              onChange={(e) => setFormData({ ...formData, contributionAmount: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="form-group">
            <label>Max Members *</label>
            <input
              type="number"
              value={formData.maxMembers}
              onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="form-group">
            <label>Frequency *</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GroupDetailsModalProps {
  group: EsusuGroup;
  onClose: () => void;
  onContributionMade: () => void;
}

const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({ group, onClose, onContributionMade }) => {
  const [contributions, setContributions] = useState<EsusuContribution[]>([]);
  const [members, setMembers] = useState<EsusuMember[]>(group.members || []);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      // Match mobile: get contributions from API
      const loadedContributions = await esusuService.getContributions(group.id);
      setContributions(loadedContributions);
      
      // Members are already in the group object from the initial load
      // Only update if group.members exists and has items
      if (group.members && group.members.length > 0) {
        setMembers(group.members);
      }
    } catch (err) {
      console.error('Error loading contributions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeContribution = async () => {
    try {
      // Match mobile API call structure
      await esusuService.makeContribution(group.id, {
        memberId: '', // Will use local user in service
        amount: group.contributionAmount,
        expectedDate: new Date(),
        paymentMethod: 'bank_transfer',
      });
      alert('Contribution made successfully');
      loadDetails();
      onContributionMade();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to make contribution';
      alert(errorMessage);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{group.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <h3>Members</h3>
          {members.length === 0 ? (
            <p className="empty-text">No members yet</p>
          ) : (
            <div className="members-list">
              {members.map((member) => (
                <div key={member.id} className="member-item">
                  <div className="member-avatar">
                    {member.fullName ? member.fullName[0].toUpperCase() : '?'}
                  </div>
                  <div className="member-info">
                    <div className="member-name">{member.fullName || 'Unknown Member'}</div>
                    <div className="member-position">Position: {member.position}</div>
                  </div>
                  {member.hasReceivedPayout && (
                    <div className="payout-badge">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="loading-spinner">Loading contributions...</div>
          ) : contributions.length > 0 && (
            <>
              <h3>Recent Contributions</h3>
              <div className="contributions-list">
                {contributions.slice(0, 5).map((contribution) => (
                  <div key={contribution.id} className="contribution-item">
                    <div className="contribution-icon">💵</div>
                    <div className="contribution-info">
                      <div className="contribution-name">{contribution.memberName}</div>
                      <div className="contribution-round">Round {contribution.round}</div>
                    </div>
                    <div className="contribution-amount">₦{contribution.amount.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="contribute-btn" onClick={handleMakeContribution}>
            Make Contribution
          </button>
        </div>
      </div>
    </div>
  );
};

export default EsusuScreen;
