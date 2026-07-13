/**
 * E2: Notification preferences and channel routing.
 * Customers configure which events trigger notifications on which channels.
 */

export interface NotificationPreference {
  id: string;
  customerId: string;
  customerName: string;
  channels: {
    sms: boolean;
    email: boolean;
    push: boolean;
    whatsapp: boolean;
    inApp: boolean;
  };
  events: {
    transaction_credit: string[];
    transaction_debit: string[];
    login: string[];
    otp: string[];
    loan_payment_due: string[];
    card_transaction: string[];
    account_statement: string[];
    promotional: string[];
  };
  quietHours: { enabled: boolean; start: string; end: string };
  language: string;
  updatedAt: string;
}

const preferences: NotificationPreference[] = [
  {
    id: "NP-001", customerId: "CUST-001", customerName: "Aisha Mohammed",
    channels: { sms: true, email: true, push: true, whatsapp: false, inApp: true },
    events: {
      transaction_credit: ["sms", "push", "inApp"],
      transaction_debit: ["sms", "email", "push", "inApp"],
      login: ["push", "inApp"],
      otp: ["sms"],
      loan_payment_due: ["sms", "email", "push"],
      card_transaction: ["sms", "push"],
      account_statement: ["email"],
      promotional: ["email", "inApp"],
    },
    quietHours: { enabled: true, start: "22:00", end: "07:00" },
    language: "en", updatedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "NP-002", customerId: "CUST-002", customerName: "Ibrahim Musa",
    channels: { sms: true, email: true, push: true, whatsapp: true, inApp: true },
    events: {
      transaction_credit: ["sms", "whatsapp", "push"],
      transaction_debit: ["sms", "email", "whatsapp", "push"],
      login: ["sms", "push"],
      otp: ["sms", "whatsapp"],
      loan_payment_due: ["sms", "email", "whatsapp"],
      card_transaction: ["sms", "whatsapp"],
      account_statement: ["email", "whatsapp"],
      promotional: [],
    },
    quietHours: { enabled: false, start: "", end: "" },
    language: "ha", updatedAt: "2026-04-15T00:00:00Z",
  },
  {
    id: "NP-003", customerId: "CUST-005", customerName: "Fatimah Abdullahi",
    channels: { sms: true, email: false, push: false, whatsapp: false, inApp: true },
    events: {
      transaction_credit: ["sms"],
      transaction_debit: ["sms"],
      login: ["sms"],
      otp: ["sms"],
      loan_payment_due: ["sms"],
      card_transaction: ["sms"],
      account_statement: ["inApp"],
      promotional: [],
    },
    quietHours: { enabled: true, start: "21:00", end: "06:00" },
    language: "en", updatedAt: "2026-05-09T13:00:00Z",
  },
];

export function getNotificationPreferences() { return preferences; }
