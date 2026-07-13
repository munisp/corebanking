import type { EsusuGroup, EsusuGroupStatus as EsusuGroupStatusType, EsusuMember, EsusuStats } from '../models/esusu';
import { apiService } from './api_service';

interface EsusuContribution {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  round: number;
  date: string;
  paymentMethod: string;
}

interface ContributionRequest {
  memberId: string;
  amount: number;
  expectedDate: Date;
  paymentMethod: string;
}

class EsusuService {
  private groupCache: Map<string, EsusuGroup> = new Map();

  async getStats(): Promise<EsusuStats> {
    const response = await apiService.get('/esusu/api/v1/esusu/stats');
    return response.data as EsusuStats;
  }

  async getGroups(myGroups = false, status?: EsusuGroupStatusType, page = 1, pageSize = 20): Promise<EsusuGroup[]> {
    const params: Record<string, unknown> = {
      page,
      limit: pageSize,
    };
    
    if (myGroups) {
      params.my_groups = true;
    }
    if (status) {
      params.status = status.toLowerCase();
    }

    const response = await apiService.get('/esusu/api/v1/esusu/groups', params);
    
    // Handle different response structures like mobile does
    let itemsRaw: unknown[];
    if (Array.isArray(response.data)) {
      itemsRaw = response.data;
    } else if (response.data && typeof response.data === 'object') {
      const dataMap = response.data as Record<string, unknown>;
      itemsRaw = (dataMap.groups || dataMap.data || []) as unknown[];
    } else {
      itemsRaw = [];
    }
    
    const groups: EsusuGroup[] = [];
    for (const item of itemsRaw) {
      if (item && typeof item === 'object') {
        const group = this.parseGroup(item as Record<string, unknown>);
        groups.push(group);
        // Cache the group data including members
        this.groupCache.set(group.id, group);
      }
    }
    
    return groups;
  }

  async getGroupById(id: string): Promise<EsusuGroup> {
    const response = await apiService.get(`/esusu/api/v1/esusu/groups/${id}`);
    const group = this.parseGroup(response.data as Record<string, unknown>);
    // Cache the group data including members
    this.groupCache.set(id, group);
    return group;
  }

  async getGroupMembers(groupId: string): Promise<EsusuMember[]> {
    // Members are included in the group response, so fetch the group
    const group = await this.getGroupById(groupId);
    return group.members || [];
  }

  async createGroup(data: {
    name: string;
    description?: string;
    contributionAmount: number;
    frequency: 'daily' | 'weekly' | 'monthly';
    maxMembers: number;
    startDate: Date;
  }): Promise<EsusuGroup> {
    const payload = {
      name: data.name,
      description: data.description,
      contribution_amount: data.contributionAmount,
      frequency: data.frequency,
      max_members: data.maxMembers,
      start_date: data.startDate.toISOString(),
    };
    
    const response = await apiService.post('/esusu/api/v1/esusu/groups', payload);
    const group = this.parseGroup(response.data as Record<string, unknown>);
    this.groupCache.set(group.id, group);
    return group;
  }

  async joinGroup(groupId: string): Promise<EsusuMember> {
    const response = await apiService.post(`/esusu/api/v1/esusu/groups/${groupId}/join`, {});
    // Clear cache so it reloads with new member
    this.groupCache.delete(groupId);
    return this.parseMember(response.data as Record<string, unknown>);
  }

  async leaveGroup(groupId: string): Promise<void> {
    await apiService.post(`/esusu/api/v1/esusu/groups/${groupId}/leave`, {});
    this.groupCache.delete(groupId);
  }

  async getContributions(groupId: string, round?: number): Promise<EsusuContribution[]> {
    const params: Record<string, unknown> = {};
    if (round !== undefined) {
      params.round = round;
    }
    
    const response = await apiService.get(`/esusu/api/v1/esusu/groups/${groupId}/contributions`, params);
    
    // Handle different response structures
    let itemsRaw: unknown[];
    if (Array.isArray(response.data)) {
      itemsRaw = response.data;
    } else if (response.data && typeof response.data === 'object') {
      const dataMap = response.data as Record<string, unknown>;
      itemsRaw = (dataMap.contributions || dataMap.data || []) as unknown[];
    } else {
      itemsRaw = [];
    }
    
    return itemsRaw.map(item => this.parseContribution(item as Record<string, unknown>));
  }

  async makeContribution(groupId: string, data: ContributionRequest): Promise<EsusuContribution> {
    const payload = {
      member_id: data.memberId,
      amount: data.amount,
      expected_date: data.expectedDate.toISOString(),
      payment_method: data.paymentMethod,
    };
    
    const response = await apiService.post(`/esusu/api/v1/esusu/groups/${groupId}/contributions`, payload);
    return this.parseContribution(response.data as Record<string, unknown>);
  }

  clearCache(groupId?: string): void {
    if (groupId) {
      this.groupCache.delete(groupId);
    } else {
      this.groupCache.clear();
    }
  }

  private parseGroup(data: Record<string, unknown>): EsusuGroup {
    const membersRaw = data.members as unknown[] | undefined;
    const members: EsusuMember[] = [];
    if (Array.isArray(membersRaw)) {
      for (const memberItem of membersRaw) {
        if (memberItem && typeof memberItem === 'object') {
          members.push(this.parseMember(memberItem as Record<string, unknown>));
        }
      }
    }

    return {
      id: String(data.id || ''),
      name: String(data.name || ''),
      description: String(data.description || ''),
      contributionAmount: Number(data.contribution_amount || data.contributionAmount || 0),
      frequency: (data.frequency as 'daily' | 'weekly' | 'monthly') || 'monthly',
      totalMembers: Number(data.max_members || data.totalMembers || 0),
      currentMembers: Number(data.current_members || data.currentMembers || members.length),
      cycleNumber: Number(data.current_cycle || data.cycle_number || data.cycleNumber || 0),
      status: String(data.status || 'pending'),
      // creator_name takes priority; admin_name as fallback
      creatorName: String(data.creator_name || data.admin_name || ''),
      members,
    };
  }

  private parseMember(data: Record<string, unknown>): EsusuMember {
    // Handle name field - API returns 'name', fallback to 'Unknown Member' if empty
    const name = data.name || data.full_name || data.fullName || '';
    const fullName = String(name).trim() || 'Unknown Member';
    
    return {
      id: String(data.id || ''),
      fullName,
      position: Number(data.position || data.payout_position || 0),
      hasReceivedPayout: Boolean(data.has_received_payout || data.hasReceivedPayout || false),
    };
  }

  private parseContribution(data: Record<string, unknown>): EsusuContribution {
    return {
      id: String(data.id || ''),
      memberId: String(data.member_id || data.memberId || ''),
      memberName: String(data.member_name || data.memberName || ''),
      amount: Number(data.amount || 0),
      round: Number(data.round || data.cycle_number || 1),
      date: String(data.contribution_date || data.date || new Date().toISOString()),
      paymentMethod: String(data.payment_method || data.paymentMethod || ''),
    };
  }
}

export const esusuService = new EsusuService();

