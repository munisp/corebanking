import apiClient from './api';
import type {
  ATMTerminal,
  ATMTerminalListResponse,
  ATMFault,
  ATMFaultListResponse,
  ATMStats,
  ATMStatus,
  FaultSeverity,
  FaultStatus,
  ReportFaultPayload,
  CreateATMPayload,
} from '../types/atm';

// APISIX prefix: /atm-management/ → strips to /v1/atm-management/...
const BASE = '/atm-management/v1/atm-management';

// ─── Adapters ────────────────────────────────────────────────────────────────

const RECORD_STATUS_TO_ATM: Record<string, ATMStatus> = {
  active:     'online',
  completed:  'online',
  processing: 'maintenance',
  pending:    'low_cash',
};

function adaptTerminal(r: Record<string, unknown>, index: number): ATMTerminal {
  const data = (r.data ?? {}) as Record<string, unknown>;
  const rawId = (r.id ?? r.ID ?? String(index)) as string;
  const rawStatus = (r.status ?? 'active') as string;
  return {
    id:                 rawId,
    terminalId:         `TRM-${rawId.slice(-6).toUpperCase()}`,
    location:           (data.region ?? data.location ?? 'Unknown') as string,
    branch:             (data.branch ?? `Branch ${index + 1}`) as string,
    state:              (data.region ?? data.state ?? 'Lagos') as string,
    type:               (r.type ?? 'CDM') as string,
    status:             RECORD_STATUS_TO_ATM[rawStatus] ?? 'online',
    cashLevel:          Number(data.cashLevel)          || 75,
    cashBalance:        Number(data.cashBalance)        || 2_500_000,
    maxCapacity:        Number(data.maxCapacity)        || 10_000_000,
    dailyTransactions:  Number(data.dailyTransactions)  || 0,
    dailyVolume:        Number(data.dailyVolume)        || 0,
    uptime30d:          Number(data.uptime30d)          || 99.5,
    lastReplenishment:  (r.updatedAt ?? r.createdAt ?? '') as string,
    nextReplenishment:  (data.nextReplenishment ?? '') as string,
    lastFault:          data.lastFault as string | undefined,
    faultType:          data.faultType as string | undefined,
  };
}

const SEVERITY_MAP: FaultSeverity[] = ['low', 'medium', 'high', 'critical'];

function adaptFault(entry: Record<string, unknown>, index: number): ATMFault {
  const rawId = (entry.id ?? entry.ID ?? String(index)) as string;
  return {
    id:           rawId,
    atmId:        (entry.recordId ?? rawId) as string,
    terminalId:   `TRM-${((entry.recordId ?? rawId) as string).slice(-6).toUpperCase()}`,
    faultType:    (entry.action ?? 'unknown') as string,
    severity:     SEVERITY_MAP[index % SEVERITY_MAP.length],
    description:  (entry.details ?? '') as string,
    status:       'open' as FaultStatus,
    reportedAt:   (entry.timestamp ?? new Date().toISOString()) as string,
    resolvedAt:   undefined,
    engineer:     (entry.actor ?? undefined) as string | undefined,
    mttrMinutes:  undefined,
  };
}

function adaptStats(raw: Record<string, unknown>): ATMStats {
  const metrics = (raw.metrics ?? {}) as Record<string, unknown>;
  return {
    totalATMs:        Number(raw.totalRecords)   || 0,
    totalCashHolding: Number(raw.activeRecords)  * 2_500_000,
    dailyTransactions: Number(raw.processedToday) || Number(metrics.throughput) || 0,
    openFaults:        Number(raw.pendingRecords) || 0,
    byStatus: {
      online:      Number(raw.activeRecords)  || 0,
      offline:     0,
      low_cash:    Number(raw.pendingRecords) || 0,
      maintenance: 0,
    },
    byState: {},
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const atmService = {
  listTerminals: (): Promise<ATMTerminalListResponse> =>
    apiClient
      .get<{ records: Record<string, unknown>[]; total: number }>(`${BASE}/list`)
      .then((r) => {
        const records = r.data.records ?? [];
        return {
          items: records.map((rec, i) => adaptTerminal(rec, i)),
          total: r.data.total ?? records.length,
        };
      }),

  listFaults: (): Promise<ATMFaultListResponse> =>
    apiClient
      .get<{ auditLog: Record<string, unknown>[]; total: number }>(`${BASE}/audit`)
      .then((r) => {
        const entries = r.data.auditLog ?? [];
        return {
          items: entries.map((e, i) => adaptFault(e, i)),
          total: r.data.total ?? entries.length,
        };
      }),

  reportFault: (payload: ReportFaultPayload): Promise<ATMFault> =>
    apiClient
      .post<{ record: Record<string, unknown> }>(`${BASE}/create`, {
        type:      payload.faultType,
        id:        payload.atmId,
        status:    payload.status ?? 'open',
        faultType: payload.faultType,
        severity:  payload.severity,
        details:   payload.description,
      })
      .then((r) => adaptFault(r.data.record ?? {}, 0)),

  createTerminal: (payload: CreateATMPayload): Promise<ATMTerminal> =>
    apiClient
      .post<{ record: Record<string, unknown> }>(`${BASE}/create`, {
        terminalId: payload.terminalId,
        type:       payload.type,
        status:     payload.status ?? 'online',
        data: {
          location:    payload.location,
          branch:      payload.branch,
          region:      payload.state,
          state:       payload.state,
          cashBalance: payload.cashBalance,
          maxCapacity: payload.maxCapacity,
        },
      })
      .then((r) => adaptTerminal(r.data.record ?? {}, 0)),

  getStats: (): Promise<ATMStats> =>
    apiClient
      .get<Record<string, unknown>>(`${BASE}/stats`)
      .then((r) => adaptStats(r.data)),
};
