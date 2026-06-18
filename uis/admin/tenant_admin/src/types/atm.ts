export type ATMStatus = 'online' | 'offline' | 'low_cash' | 'maintenance';
export type FaultSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FaultStatus = 'open' | 'in_progress' | 'resolved';

export interface ATMTerminal {
  id: string;
  terminalId: string;
  location: string;
  branch: string;
  state: string;
  type: string;
  status: ATMStatus;
  cashLevel: number;
  cashBalance: number;
  maxCapacity: number;
  dailyTransactions: number;
  dailyVolume: number;
  uptime30d: number;
  lastReplenishment: string;
  nextReplenishment: string;
  lastFault?: string;
  faultType?: string;
}

export interface ATMTerminalListResponse {
  items: ATMTerminal[];
  total: number;
}

export interface ATMFault {
  id: string;
  atmId: string;
  terminalId: string;
  faultType: string;
  severity: FaultSeverity;
  description: string;
  status: FaultStatus;
  reportedAt: string;
  resolvedAt?: string;
  engineer?: string;
  mttrMinutes?: number;
}

export interface ATMFaultListResponse {
  items: ATMFault[];
  total: number;
}

export interface CreateATMPayload {
  terminalId: string;
  location: string;
  branch: string;
  state: string;
  type: string;
  status?: ATMStatus;
  cashBalance?: number;
  maxCapacity?: number;
}

export interface ReportFaultPayload {
  atmId: string;
  terminalId?: string;
  faultType: string;
  severity?: FaultSeverity;
  description?: string;
  status?: FaultStatus;
}

export interface ATMStatsByStatus {
  online: number;
  offline: number;
  low_cash: number;
  maintenance: number;
}

export interface ATMStats {
  totalATMs: number;
  totalCashHolding: number;
  dailyTransactions: number;
  openFaults: number;
  byStatus: ATMStatsByStatus;
  byState: Record<string, number>;
}
