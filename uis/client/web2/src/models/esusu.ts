export type EsusuGroupStatus = 'active' | 'pending' | 'completed' | 'cancelled';

export const EsusuGroupStatus = {
  Active: 'active' as const,
  Pending: 'pending' as const,
  Completed: 'completed' as const,
  Cancelled: 'cancelled' as const,
};

export interface EsusuStats {
  totalGroups: number;
  activeParticipations: number;
  totalContributed: number;
  totalReceived: number;
  nextPayoutDate?: Date;
  nextPayoutAmount: number;
}

export interface EsusuGroup {
  id: string;
  name: string;
  description: string;
  contributionAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  totalMembers: number;
  currentMembers: number;
  cycleNumber: number;
  status: string;
  creatorName: string;
  members?: EsusuMember[];
}

export interface EsusuMember {
  id: string;
  fullName: string;
  position: number;
  hasReceivedPayout: boolean;
}
