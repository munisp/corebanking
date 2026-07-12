/**
 * B4: Trade Finance documentary collections — D/P, D/A, clean collections.
 * Supports SWIFT messaging, discrepancy handling, and settlement tracking.
 */

export interface DocumentaryCollection {
  id: string;
  type: "documents_against_payment" | "documents_against_acceptance" | "clean_collection";
  collectionNumber: string;
  drawer: { name: string; bank: string; country: string };
  drawee: { name: string; bank: string; country: string };
  amount: number;
  currency: string;
  tenor?: string;
  documents: Array<{ type: string; copies: number; status: "received" | "pending" | "released" }>;
  status: "received" | "presented" | "accepted" | "paid" | "protested" | "returned";
  charges: number;
  swiftMessages: string[];
  createdAt: string;
  maturityDate?: string;
  settlementDate?: string;
}

const collections: DocumentaryCollection[] = [
  {
    id: "DC-001", type: "documents_against_payment", collectionNumber: "COL-2026-001",
    drawer: { name: "Shanghai Electronics Ltd", bank: "Bank of China", country: "CN" },
    drawee: { name: "Lagos Tech Imports", bank: "54Bank", country: "NG" },
    amount: 850_000, currency: "USD",
    documents: [
      { type: "Bill of Lading", copies: 3, status: "received" },
      { type: "Commercial Invoice", copies: 2, status: "received" },
      { type: "Packing List", copies: 2, status: "received" },
      { type: "Certificate of Origin", copies: 1, status: "received" },
      { type: "Insurance Certificate", copies: 1, status: "received" },
    ],
    status: "presented", charges: 12_500,
    swiftMessages: ["MT400", "MT410"],
    createdAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "DC-002", type: "documents_against_acceptance", collectionNumber: "COL-2026-002",
    drawer: { name: "Hamburg Machinery GmbH", bank: "Deutsche Bank", country: "DE" },
    drawee: { name: "Ogun Steel Mills", bank: "54Bank", country: "NG" },
    amount: 2_500_000, currency: "EUR", tenor: "90 days sight",
    documents: [
      { type: "Bill of Exchange", copies: 2, status: "received" },
      { type: "Bill of Lading", copies: 3, status: "received" },
      { type: "Commercial Invoice", copies: 2, status: "received" },
      { type: "Inspection Certificate", copies: 1, status: "pending" },
    ],
    status: "accepted", charges: 35_000,
    swiftMessages: ["MT400", "MT412"],
    createdAt: "2026-04-15T00:00:00Z", maturityDate: "2026-07-14",
  },
  {
    id: "DC-003", type: "clean_collection", collectionNumber: "COL-2026-003",
    drawer: { name: "Dubai Commodities FZE", bank: "Emirates NBD", country: "AE" },
    drawee: { name: "Abuja Trading Company", bank: "54Bank", country: "NG" },
    amount: 320_000, currency: "USD",
    documents: [
      { type: "Promissory Note", copies: 1, status: "received" },
      { type: "Bill of Exchange", copies: 1, status: "received" },
    ],
    status: "paid", charges: 4_800,
    swiftMessages: ["MT400", "MT410", "MT416"],
    createdAt: "2026-03-20T00:00:00Z", settlementDate: "2026-05-05",
  },
];

export function getDocumentaryCollections() { return collections; }
