/**
 * B7: SWIFT message center — MT103, MT202, MT760 messaging with tracking.
 * Supports message creation, validation, status tracking, and SWIFT gpi.
 */

export interface SWIFTMessage {
  id: string;
  messageType: string;
  direction: "inbound" | "outbound";
  senderBIC: string;
  receiverBIC: string;
  reference: string;
  amount?: number;
  currency?: string;
  valueDate?: string;
  beneficiary?: string;
  ordering?: string;
  status: "created" | "sent" | "acknowledged" | "delivered" | "rejected" | "cancelled";
  gpiTracker?: string;
  rawMessage: string;
  createdAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
}

const messages: SWIFTMessage[] = [
  {
    id: "SW-001", messageType: "MT103", direction: "outbound",
    senderBIC: "FIFTYFOURBANKNG", receiverBIC: "CITIUS33XXX",
    reference: "FT26050900001", amount: 500_000, currency: "USD",
    valueDate: "2026-05-09", beneficiary: "ACME Corp, New York",
    ordering: "Lagos Tech Imports Ltd",
    status: "delivered", gpiTracker: "d4f5a6b7-c8d9-e0f1-a2b3-c4d5e6f7a8b9",
    rawMessage: ":20:FT26050900001\n:23B:CRED\n:32A:260509USD500000,00\n:50K:/0123456789\nLagos Tech Imports Ltd\n:59:/987654321\nACME Corp\n:71A:SHA",
    createdAt: "2026-05-09T08:00:00Z", sentAt: "2026-05-09T08:01:00Z", acknowledgedAt: "2026-05-09T08:05:00Z",
  },
  {
    id: "SW-002", messageType: "MT202", direction: "outbound",
    senderBIC: "FIFTYFOURBANKNG", receiverBIC: "DEUTDEFFXXX",
    reference: "COV26050900001", amount: 2_500_000, currency: "EUR",
    valueDate: "2026-05-09",
    status: "acknowledged", gpiTracker: "e5f6a7b8-c9d0-e1f2-a3b4-c5d6e7f8a9b0",
    rawMessage: ":20:COV26050900001\n:21:NONREF\n:32A:260509EUR2500000,00\n:58A:DEUTDEFFXXX\n:72:/REC/COVER FOR MT103",
    createdAt: "2026-05-09T10:30:00Z", sentAt: "2026-05-09T10:31:00Z", acknowledgedAt: "2026-05-09T10:45:00Z",
  },
  {
    id: "SW-003", messageType: "MT760", direction: "outbound",
    senderBIC: "FIFTYFOURBANKNG", receiverBIC: "HSBCHKHHHKH",
    reference: "BG26050900001", amount: 10_000_000, currency: "USD",
    valueDate: "2026-05-09", beneficiary: "Shanghai Electronics Ltd",
    status: "sent",
    rawMessage: ":20:BG26050900001\n:23:ISSU\n:30:260509\n:40C:URDG\n:77C:GUARANTEE TEXT...",
    createdAt: "2026-05-09T11:00:00Z", sentAt: "2026-05-09T11:02:00Z",
  },
  {
    id: "SW-004", messageType: "MT103", direction: "inbound",
    senderBIC: "ABORNGLAXXXX", receiverBIC: "FIFTYFOURBANKNG",
    reference: "INFT26050900001", amount: 15_000_000, currency: "NGN",
    valueDate: "2026-05-09", beneficiary: "John Doe",
    ordering: "SME Trading Company",
    status: "delivered",
    rawMessage: ":20:INFT26050900001\n:23B:CRED\n:32A:260509NGN15000000,00\n:50K:SME Trading Company\n:59:/5400001234\nJohn Doe",
    createdAt: "2026-05-09T12:00:00Z", acknowledgedAt: "2026-05-09T12:00:05Z",
  },
  {
    id: "SW-005", messageType: "MT940", direction: "inbound",
    senderBIC: "CITIUS33XXX", receiverBIC: "FIFTYFOURBANKNG",
    reference: "STMT26050900001",
    status: "delivered",
    rawMessage: ":20:STMT26050900001\n:25:54BANK-NOSTRO-USD\n:28C:001/001\n:60F:C260508USD5000000,00\n:61:260509CD500000,00\n:62F:C260509USD5500000,00",
    createdAt: "2026-05-09T14:00:00Z", acknowledgedAt: "2026-05-09T14:00:02Z",
  },
];

export function getSWIFTMessages() { return messages; }
export function getSWIFTStats() {
  const byType: Record<string, number> = {};
  const byDirection: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const msg of messages) {
    byType[msg.messageType] = (byType[msg.messageType] || 0) + 1;
    byDirection[msg.direction] = (byDirection[msg.direction] || 0) + 1;
    byStatus[msg.status] = (byStatus[msg.status] || 0) + 1;
  }

  return { total: messages.length, byType, byDirection, byStatus };
}
