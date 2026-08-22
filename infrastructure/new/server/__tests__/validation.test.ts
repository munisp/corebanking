import { describe, it, expect } from "vitest";

// H-40 remediation: the previous version defined its own zod schemas inside
// the test (including a different BVN rule than production's) and validated
// those copies — production schemas were never exercised. These tests import
// the real lib/validation schemas, including the money-critical
// transferCreateSchema, and drive the production validateBody middleware.
import {
  transferCreateSchema,
  customerCreateSchema,
  billingUsageEventSchema,
  paginationSchema,
  validateBody,
} from "../lib/validation";

describe("transferCreateSchema (production lib/validation)", () => {
  const validTransfer = {
    customerId: "cust-001",
    beneficiaryName: "Ada Obi",
    amount: 5000,
    transferType: "bank",
    accountNumber: "0123456789",
    narration: "school fees",
  };

  it("accepts a well-formed transfer", () => {
    const result = transferCreateSchema.safeParse(validTransfer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5000);
    }
  });

  it("rejects negative and zero amounts — money can never move on a non-positive amount", () => {
    for (const amount of [-100, 0, -0.01]) {
      const result = transferCreateSchema.safeParse({ ...validTransfer, amount });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing customer id or beneficiary name", () => {
    const noCustomer = { ...validTransfer } as any;
    delete noCustomer.customerId;
    expect(transferCreateSchema.safeParse(noCustomer).success).toBe(false);

    const noBeneficiary = { ...validTransfer } as any;
    delete noBeneficiary.beneficiaryName;
    expect(transferCreateSchema.safeParse(noBeneficiary).success).toBe(false);
  });

  it("rejects unknown transfer types", () => {
    const result = transferCreateSchema.safeParse({ ...validTransfer, transferType: "western-union" });
    expect(result.success).toBe(false);
    for (const t of ["bank", "wallet", "workflow"]) {
      expect(transferCreateSchema.safeParse({ ...validTransfer, transferType: t }).success).toBe(true);
    }
  });
});

describe("customerCreateSchema (production lib/validation)", () => {
  const validCustomer = {
    name: "Ada Obi",
    segment: "retail",
    tier: "tier-3",
    location: "Lagos",
    relationshipManager: "rm-01",
    risk: "low",
    bvn: "22221234567",
    phone: "+2348012345678",
  };

  it("accepts a well-formed customer and defaults balance to 0", () => {
    const result = customerCreateSchema.safeParse(validCustomer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.balance).toBe(0);
    }
  });

  it("rejects BVNs that are not exactly 11 digits", () => {
    for (const bvn of ["123", "abcdefghijk", "123456789012", ""]) {
      expect(customerCreateSchema.safeParse({ ...validCustomer, bvn }).success).toBe(false);
    }
  });

  it("rejects a negative starting balance", () => {
    expect(customerCreateSchema.safeParse({ ...validCustomer, balance: -1 }).success).toBe(false);
  });
});

describe("billingUsageEventSchema (production lib/validation)", () => {
  it("rejects non-positive quantities (billing integrity)", () => {
    const base = {
      tenantId: "t1",
      sourceService: "core-banking",
      sourceEventType: "transfer.completed",
      meterKey: "transfers",
      productKey: "nip",
    };
    expect(billingUsageEventSchema.safeParse({ ...base, quantity: 1 }).success).toBe(true);
    expect(billingUsageEventSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(billingUsageEventSchema.safeParse({ ...base, quantity: -5 }).success).toBe(false);
    expect(billingUsageEventSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
  });
});

describe("paginationSchema (production lib/validation)", () => {
  it("caps limit at 200 and defaults to 50", () => {
    const capped = paginationSchema.safeParse({ limit: 201 });
    expect(capped.success).toBe(false);

    const def = paginationSchema.safeParse({});
    expect(def.success).toBe(true);
    if (def.success) {
      expect(def.data.limit).toBe(50);
      expect(def.data.offset).toBe(0);
    }
  });
});

describe("validateBody middleware (production lib/validation)", () => {
  it("routes invalid payloads to the error handler as a 400 VALIDATION_ERROR", () => {
    const middleware = validateBody(transferCreateSchema);
    const req: any = { body: { amount: -50 } };
    let nextArg: any = "not-called";
    middleware(req, {} as any, (arg?: any) => { nextArg = arg ?? null; });
    expect(nextArg).not.toBeNull();
    expect(nextArg.statusCode).toBe(400);
    expect(nextArg.code).toBe("VALIDATION_ERROR");
    expect(nextArg.message).toContain("Validation failed");
  });

  it("valid payloads reach the handler with parsed (stripped) data", () => {
    const middleware = validateBody(transferCreateSchema);
    const req: any = {
      body: {
        customerId: "cust-1",
        beneficiaryName: "B",
        amount: 100,
        transferType: "internal", // invalid enum — must NOT pass
      },
    };
    let nextArg: any = "not-called";
    middleware(req, {} as any, (arg?: any) => { nextArg = arg ?? null; });
    expect(nextArg.statusCode).toBe(400);

    const good: any = {
      body: {
        customerId: "cust-1",
        beneficiaryName: "B",
        amount: 100,
        transferType: "bank",
        smuggled: "must-be-stripped",
      },
    };
    let okNext: any = "not-called";
    middleware(good, {} as any, (arg?: any) => { okNext = arg ?? null; });
    expect(okNext).toBeNull();
    expect(good.body.amount).toBe(100);
    expect(good.body.smuggled).toBeUndefined(); // zod strips unknown keys
  });
});
