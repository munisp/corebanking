export interface LetterOfCredit {
  id: string;
  lcRef: string;
  type: string; // irrevocable | revocable | standby | confirmed
  applicantId: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  amount: number;
  currency: string;
  availableBy: string;
  expiryDate: string;
  placeOfExpiry: string;
  goodsDescription: string;
  swiftRef: string;
  status: string; // draft | issued | confirmed | amended | expired | cancelled
  issuedAt?: string;
  createdAt: string;
}

export interface BankGuarantee {
  id: string;
  guaranteeRef: string;
  type: string; // performance | payment | bid_bond | advance_payment
  applicantId: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  expiryDate: string;
  purpose: string;
  status: string; // draft | issued | extended | cancelled | expired
  createdAt: string;
}

export interface FactoringApplication {
  id: string;
  applicationRef: string;
  applicantId: string;
  debtorName: string;
  invoiceTotal: number;
  factoringAmount: number;
  currency: string;
  discountRate: number;
  status: string; // pending | approved | rejected | disbursed
  invoiceCount: number;
  createdAt: string;
}

export function lcFromJson(json: Record<string, any>): LetterOfCredit {
  return {
    id: String(json.id ?? ''),
    lcRef: String(json.lc_ref ?? json.lcRef ?? ''),
    type: String(json.type ?? 'irrevocable'),
    applicantId: String(json.applicant_id ?? json.applicantId ?? ''),
    beneficiaryName: String(json.beneficiary_name ?? json.beneficiaryName ?? ''),
    beneficiaryCountry: String(json.beneficiary_country ?? json.beneficiaryCountry ?? ''),
    amount: Number(json.amount ?? 0),
    currency: String(json.currency ?? 'USD'),
    availableBy: String(json.available_by ?? json.availableBy ?? ''),
    expiryDate: String(json.expiry_date ?? json.expiryDate ?? ''),
    placeOfExpiry: String(json.place_of_expiry ?? json.placeOfExpiry ?? ''),
    goodsDescription: String(json.goods_description ?? json.goodsDescription ?? ''),
    swiftRef: String(json.swift_ref ?? json.swiftRef ?? ''),
    status: String(json.status ?? 'draft'),
    issuedAt: json.issued_at ? String(json.issued_at) : json.issuedAt ? String(json.issuedAt) : undefined,
    createdAt: String(json.created_at ?? json.createdAt ?? ''),
  };
}

export function bgFromJson(json: Record<string, any>): BankGuarantee {
  return {
    id: String(json.id ?? ''),
    guaranteeRef: String(json.guarantee_ref ?? json.guaranteeRef ?? ''),
    type: String(json.type ?? 'performance'),
    applicantId: String(json.applicant_id ?? json.applicantId ?? ''),
    beneficiaryName: String(json.beneficiary_name ?? json.beneficiaryName ?? ''),
    amount: Number(json.amount ?? 0),
    currency: String(json.currency ?? 'NGN'),
    expiryDate: String(json.expiry_date ?? json.expiryDate ?? ''),
    purpose: String(json.purpose ?? ''),
    status: String(json.status ?? 'draft'),
    createdAt: String(json.created_at ?? json.createdAt ?? ''),
  };
}

export function factoringFromJson(json: Record<string, any>): FactoringApplication {
  return {
    id: String(json.id ?? ''),
    applicationRef: String(json.application_ref ?? json.applicationRef ?? ''),
    applicantId: String(json.applicant_id ?? json.applicantId ?? ''),
    debtorName: String(json.debtor_name ?? json.debtorName ?? ''),
    invoiceTotal: Number(json.invoice_total ?? json.invoiceTotal ?? 0),
    factoringAmount: Number(json.factoring_amount ?? json.factoringAmount ?? 0),
    currency: String(json.currency ?? 'NGN'),
    discountRate: Number(json.discount_rate ?? json.discountRate ?? 0),
    status: String(json.status ?? 'pending'),
    invoiceCount: Number(json.invoice_count ?? json.invoiceCount ?? 0),
    createdAt: String(json.created_at ?? json.createdAt ?? ''),
  };
}
