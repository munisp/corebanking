// Design reminder: preserve the recovered compact mobile transfer journey while moving the critical
// money-movement lifecycle onto active server-backed servicing endpoints. Keep the interface dense,
// clear, and confidence-building rather than dashboard-like or overly abstract.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useCustomerSession } from "@/contexts/CustomerSessionContext";
type CustomerTransferDraft = {
  transferType: "bank" | "wallet" | "workflow";
  beneficiaryId: string;
  workflowId: string;
  amount: string;
  narration: string;
};

const emptyDraft: CustomerTransferDraft = {
  transferType: "bank",
  beneficiaryId: "",
  workflowId: "",
  amount: "",
  narration: "",
};

import {
  confirmCustomerTransferOtp,
  createCustomerTransfer,
  formatCurrency,
  getCustomerBeneficiaries,
  getCustomerTransfers,
  requestCustomerTransferOtp,
  saveCustomerBeneficiary,
  type CustomerBeneficiaryRecord as CustomerBeneficiary,
  type CustomerTransferRecord,
} from "@/lib/platform";

const banks = [
  { code: "011", name: "First Bank" },
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access Bank" },
  { code: "033", name: "UBA" },
  { code: "057", name: "Zenith Bank" },
  { code: "032", name: "Union Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "221", name: "Stanbic IBTC" },
] as const;

const quickAmounts = [1000, 5000, 10000, 20000, 50000, 100000] as const;

type TransferTab = "transfer" | "beneficiaries";
type TransferType = CustomerTransferDraft["transferType"];
type TransferStage = "edit" | "review" | "otp";

export default function CustomerTransfers() {
  const { activeCustomer, customers, workflows, addNotification, tenantConfiguration } = useCustomerSession();

  const [activeTab, setActiveTab] = useState<TransferTab>("transfer");
  const [stage, setStage] = useState<TransferStage>("edit");
  const [transferType, setTransferType] = useState<TransferType>(emptyDraft.transferType);
  const [draft, setDraft] = useState<CustomerTransferDraft>(emptyDraft);
  const [beneficiaries, setBeneficiaries] = useState<CustomerBeneficiary[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<CustomerTransferRecord[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCode, setOtpCode] = useState("542001");
  const [otpReference, setOtpReference] = useState<string | null>(null);
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshTransfers(customerId?: string) {
    if (!customerId) return;
    try {
      const response = await getCustomerTransfers(customerId);
      setRecentTransfers(response.items);
    } catch {
      setMessage("Unable to refresh recent transfer history right now.");
    }
  }

  useEffect(() => {
    if (!activeCustomer?.id) {
      setBeneficiaries([]);
      return;
    }
    let active = true;
    void getCustomerBeneficiaries(activeCustomer.id)
      .then((response) => {
        if (active) setBeneficiaries(response.items);
      })
      .catch(() => {
        if (active) {
          setBeneficiaries(
            customers
              .filter((customer) => customer.id !== activeCustomer.id)
              .slice(0, 8)
              .map((customer) => ({
                id: `beneficiary-${customer.id}`,
                customerId: activeCustomer.id,
                name: customer.name,
                phone: customer.phone,
                location: customer.location,
                addedAt: new Date().toISOString(),
                source: "customer" as const,
              })),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [activeCustomer?.id, customers]);

  useEffect(() => {
    void refreshTransfers(activeCustomer?.id);
  }, [activeCustomer?.id]);

  const filteredBeneficiaries = useMemo(
    () => beneficiaries.filter((beneficiary) => beneficiary.customerId !== activeCustomer?.id),
    [activeCustomer?.id, beneficiaries],
  );

  const selectedBeneficiary = useMemo(
    () => filteredBeneficiaries.find((beneficiary) => beneficiary.id === draft.beneficiaryId) ?? null,
    [draft.beneficiaryId, filteredBeneficiaries],
  );

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === draft.workflowId) ?? null,
    [draft.workflowId, workflows],
  );

  const parsedAmount = Number(draft.amount || 0);
  const selectedBankName = banks.find((bank) => bank.code === bankCode)?.name ?? "";
  const enabledFeatureKeys = new Set([
    ...(tenantConfiguration?.enabledModules ?? []),
    ...((tenantConfiguration?.featureFlags ?? []).filter((flag) => flag.enabled).map((flag) => flag.key)),
  ]);
  const transfersEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("transfers");
  const workflowTransfersEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("workflow_transfers") || enabledFeatureKeys.has("workflows");
  const walletTransfersEnabled = enabledFeatureKeys.size === 0 || enabledFeatureKeys.has("wallet") || enabledFeatureKeys.has("wallet_transfers");

  const recentCustomerTransfers = recentTransfers
    .filter((transfer) => transfer.customerId === (activeCustomer?.id ?? recentTransfers[0]?.customerId))
    .slice(0, 5);
  const pendingApprovalTransfers = recentCustomerTransfers.filter(
    (transfer) => transfer.approvalState === "pending_review" || transfer.status === "submitted",
  );
  const completedTransfers = recentCustomerTransfers.filter((transfer) => transfer.status === "completed");

  function persist(next: Partial<CustomerTransferDraft>) {
    const updated = { ...draft, ...next };
    setDraft(updated);
  }

  function resetToEdit(nextMessage?: string) {
    setStage("edit");
    setOtp("");
    setOtpReference(null);
    setPendingTransferId(null);
    if (nextMessage) setMessage(nextMessage);
  }

  function handleVerifyAccount(nextAccountNumber = accountNumber, nextBankCode = bankCode) {
    if (transferType === "workflow") {
      setAccountName(selectedWorkflow?.customer ?? "");
      return;
    }

    if (selectedBeneficiary) {
      setAccountName(selectedBeneficiary.name);
      return;
    }

    if (nextAccountNumber.length === 10 && nextBankCode) {
      setIsVerifying(true);
      window.setTimeout(() => {
        setAccountName("John Doe");
        setIsVerifying(false);
      }, 600);
    } else {
      setAccountName("");
    }
  }

  function validateDraft() {
    if (!parsedAmount) {
      setMessage("Please enter an amount before continuing.");
      return false;
    }

    if (transferType === "workflow" && !draft.workflowId) {
      setMessage("Select a workflow destination before continuing.");
      return false;
    }

    if (transferType !== "workflow" && !selectedBeneficiary && (!accountNumber || !bankCode || !accountName)) {
      setMessage("Please complete the destination account details before continuing.");
      return false;
    }

    return true;
  }

  function handleReview() {
    if (!transfersEnabled) {
      setMessage("Transfers are currently disabled for this tenant during onboarding governance.");
      return;
    }

    if (transferType === "workflow" && !workflowTransfersEnabled) {
      setMessage("Workflow transfers are not enabled for this tenant yet.");
      return;
    }

    if (transferType === "wallet" && !walletTransfersEnabled) {
      setMessage("Wallet transfers are not enabled for this tenant yet.");
      return;
    }

    if (!validateDraft()) return;
    setStage("review");
    setMessage("Review the transfer details before requesting the confirmation code.");
  }

  async function handleRequestOtp() {
    if (!validateDraft() || !activeCustomer?.id) return;

    const beneficiaryName =
      transferType === "workflow"
        ? selectedWorkflow?.customer ?? "Workflow destination"
        : accountName || selectedBeneficiary?.name || "Account destination";

    setIsSubmitting(true);
    try {
      const created = await createCustomerTransfer({
        customerId: activeCustomer.id,
        beneficiaryId: selectedBeneficiary?.id,
        beneficiaryName,
        amount: parsedAmount,
        narration: draft.narration || "Customer transfer instruction",
        transferType,
        bankCode: transferType === "workflow" ? undefined : bankCode,
        bankName: transferType === "workflow" ? undefined : selectedBankName,
        accountNumber: transferType === "workflow" ? undefined : accountNumber,
        accountName: transferType === "workflow" ? undefined : accountName,
        workflowId: transferType === "workflow" ? draft.workflowId : undefined,
      });

      const otpResponse = await requestCustomerTransferOtp(created.transfer.id);
      setPendingTransferId(created.transfer.id);
      setOtpReference(otpResponse.otp.otpReference);
      setOtpCode(otpResponse.otp.previewCode || "542001");
      setStage("otp");
      setMessage(`A confirmation code has been issued to ${activeCustomer.phone ?? "your registered number"}. Use ${otpResponse.otp.previewCode || "542001"} in this preview.`);
      await refreshTransfers(activeCustomer.id);
    } catch {
      setMessage("Unable to issue a confirmation code right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitTransfer() {
    if (!pendingTransferId || !otpReference || !activeCustomer?.id) {
      setMessage("Request a confirmation code before completing this transfer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await confirmCustomerTransferOtp(pendingTransferId, {
        otpReference,
        otpCode: otp.trim(),
      });

      if (selectedBeneficiary) {
        const persistedBeneficiary = {
          ...selectedBeneficiary,
          customerId: activeCustomer.id,
          addedAt: new Date().toISOString(),
          source: selectedBeneficiary.source || "transfer",
        };
        setBeneficiaries((current) => [persistedBeneficiary, ...current.filter((item) => item.id !== persistedBeneficiary.id)].slice(0, 20));
        void saveCustomerBeneficiary(persistedBeneficiary).catch(() => null);
      }

      addNotification({
        title: response.transfer.status === "completed" ? "Transfer completed" : "Transfer submitted for review",
        message: `${response.transfer.beneficiaryName} has been queued for ${formatCurrency(response.transfer.amount)}.`,
        type: response.transfer.status === "completed" ? "success" : "info",
        actionUrl: "/customer/statements",
      });

      setDraft(emptyDraft);
      setTransferType("bank");
      setAccountNumber("");
      setBankCode("");
      setAccountName("");
      setOtp("");
      setOtpReference(null);
      setPendingTransferId(null);
      setStage("edit");
      await refreshTransfers(activeCustomer.id);
      setMessage(
        response.transfer.status === "completed"
          ? `Transfer completed for ${response.transfer.beneficiaryName}. The instruction now appears in your recent transfer history.`
          : `Transfer submitted for ${response.transfer.beneficiaryName}. An operator approval is required before final completion.`,
      );
    } catch {
      setMessage("The confirmation code entered is not valid for this transfer or the transfer could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectBeneficiary(beneficiary: CustomerBeneficiary) {
    persist({ beneficiaryId: beneficiary.id });
    setTransferType("bank");
    setAccountNumber("");
    setBankCode("");
    setAccountName(beneficiary.name);
    setActiveTab("transfer");
    resetToEdit("Beneficiary selected. You can now confirm the amount and narration.");
  }

  const reviewDestination =
    transferType === "workflow"
      ? `${selectedWorkflow?.customer ?? "Workflow destination"}${selectedWorkflow ? ` · ${selectedWorkflow.stage}` : ""}`
      : selectedBeneficiary
        ? `${selectedBeneficiary.name} · ${selectedBeneficiary.location}`
        : `${accountName || "Unverified account"}${selectedBankName ? ` · ${selectedBankName}` : ""}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <div className="mx-auto w-full max-w-md bg-slate-50 shadow-none lg:mt-6 lg:max-w-xl lg:overflow-hidden lg:rounded-[2rem] lg:shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
        <header className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${tenantConfiguration?.whiteLabel?.primaryColor ?? "#047857"} 0%, ${tenantConfiguration?.whiteLabel?.accentColor ?? "#065f46"} 100%)` }}>
          <div className="mb-4 flex items-center gap-4">
            <Link href="/customer/dashboard" className="text-white">
              <span className="text-2xl">←</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Transfer Money</h1>
              <p className="mt-1 text-xs text-white/80">{tenantConfiguration?.whiteLabel?.displayName ?? "54Bank"} · {tenantConfiguration?.onboardingStatus ?? "active"} onboarding governance</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "bank", label: "Bank Transfer" },
              { id: "wallet", label: "Wallet" },
              { id: "workflow", label: "Workflow" },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                  onClick={() => {
                    const nextType = type.id as TransferType;
                    if (nextType === "workflow" && !workflowTransfersEnabled) {
                      setMessage("Workflow transfers are disabled for this tenant configuration.");
                      return;
                    }
                    if (nextType === "wallet" && !walletTransfersEnabled) {
                      setMessage("Wallet transfers are disabled for this tenant configuration.");
                      return;
                    }
                    setTransferType(nextType);
                    persist({ transferType: nextType, workflowId: nextType === "workflow" ? draft.workflowId : "", beneficiaryId: nextType === "workflow" ? "" : draft.beneficiaryId });
                    setAccountName("");
                    if (nextType !== "workflow") setBankCode("");
                    resetToEdit("Transfer type updated.");
                  }}

                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${transferType === type.id ? "bg-white text-emerald-700" : "bg-white/20 text-white"}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </header>

        <main className="px-4 pb-8">
          {!transfersEnabled ? (
            <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="text-sm font-semibold">Transfers are temporarily paused</p>
              <p className="mt-1 text-xs text-amber-800">History stays visible while onboarding approval is still pending for this tenant.</p>
            </section>
          ) : null}

          <section className="-mt-2 overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="flex border-b">
              <button type="button" onClick={() => setActiveTab("transfer")} className={`flex-1 py-3 text-sm font-medium ${activeTab === "transfer" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500"}`}>
                New Transfer
              </button>
              <button type="button" onClick={() => setActiveTab("beneficiaries")} className={`flex-1 py-3 text-sm font-medium ${activeTab === "beneficiaries" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500"}`}>
                Beneficiaries
              </button>
            </div>

            {activeTab === "transfer" ? (
              <div className="space-y-4 p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key: "edit", label: "Draft" },
                    { key: "review", label: "Review" },
                    { key: "otp", label: "Confirm" },
                  ].map((item) => (
                    <div key={item.key} className={`rounded-xl px-3 py-2 text-sm font-medium ${stage === item.key ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
                      {item.label}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₦</span>
                    <input
                      type="number"
                      value={draft.amount}
                      onChange={(event) => {
                        persist({ amount: event.target.value });
                        if (stage !== "edit") resetToEdit();
                      }}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-lg font-semibold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => {
                          persist({ amount: amount.toString() });
                          if (stage !== "edit") resetToEdit();
                        }}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
                      >
                        ₦{amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {transferType === "workflow" ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Workflow Destination</label>
                    <select
                      value={draft.workflowId}
                      onChange={(event) => {
                        persist({ workflowId: event.target.value, beneficiaryId: "" });
                        setAccountName(workflows.find((workflow) => workflow.id === event.target.value)?.customer ?? "");
                        if (stage !== "edit") resetToEdit();
                      }}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Choose a workflow</option>
                      {workflows.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.customer} · {workflow.stage}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Select Bank</label>
                      <select
                        value={bankCode}
                        onChange={(event) => {
                          setBankCode(event.target.value);
                          persist({ beneficiaryId: "" });
                          setAccountName("");
                          handleVerifyAccount(accountNumber, event.target.value);
                          if (stage !== "edit") resetToEdit();
                        }}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Choose a bank</option>
                        {banks.map((bank) => (
                          <option key={bank.code} value={bank.code}>{bank.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Account Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(event) => {
                          setAccountNumber(event.target.value);
                          persist({ beneficiaryId: "" });
                          setAccountName("");
                          handleVerifyAccount(event.target.value, bankCode);
                          if (stage !== "edit") resetToEdit();
                        }}
                        placeholder="Enter 10-digit account number"
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                      />
                      {isVerifying ? <p className="mt-1 text-sm text-slate-500">Verifying account...</p> : null}
                      {accountName ? (
                        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="font-medium text-emerald-700">{accountName}</p>
                          {selectedBankName ? <p className="text-sm text-emerald-700/80">{selectedBankName}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Narration (Optional)</label>
                  <input
                    type="text"
                    value={draft.narration}
                    onChange={(event) => {
                      persist({ narration: event.target.value });
                      if (stage !== "edit") resetToEdit();
                    }}
                    placeholder="What's this for?"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {stage === "review" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">Review Summary</p>
                    <p className="mt-2">Amount: {formatCurrency(parsedAmount)}</p>
                    <p>Destination: {reviewDestination}</p>
                    {draft.narration ? <p>Narration: {draft.narration}</p> : null}
                  </div>
                ) : null}

                {stage === "otp" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <label className="mb-2 block text-sm font-medium text-amber-900">Confirmation Code</label>
                    <input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder="Enter 6-digit code"
                      className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="mt-2 text-xs text-amber-800">Preview code: {otpCode}</p>
                  </div>
                ) : null}

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Runtime note</p>
                  <p className="mt-1">Support: {tenantConfiguration?.whiteLabel?.supportEmail ?? "platform-operations@54bank.app"} · modules: {(tenantConfiguration?.enabledModules ?? []).join(", ") || "default runtime set"}</p>
                </div>

                {message ? <p className="text-sm text-slate-500">{message}</p> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {stage === "edit" ? (
                      <button type="button" onClick={handleReview} disabled={!transfersEnabled} className="w-full rounded-xl bg-emerald-700 py-4 font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300">

                      Review ₦{parsedAmount ? parsedAmount.toLocaleString() : "0"}
                    </button>
                  ) : null}

                  {stage === "review" ? (
                    <>
                      <button type="button" onClick={() => resetToEdit("Continue editing the transfer draft.")} className="w-full rounded-xl bg-slate-100 py-4 font-semibold text-slate-700 transition-colors hover:bg-slate-200">
                        Edit Transfer
                      </button>
                      <button type="button" onClick={() => void handleRequestOtp()} disabled={isSubmitting} className="w-full rounded-xl bg-emerald-700 py-4 font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400">
                        {isSubmitting ? "Issuing Code..." : "Request Confirmation Code"}
                      </button>
                    </>
                  ) : null}

                  {stage === "otp" ? (
                    <>
                      <button type="button" onClick={() => setStage("review")} className="w-full rounded-xl bg-slate-100 py-4 font-semibold text-slate-700 transition-colors hover:bg-slate-200">
                        Back to Review
                      </button>
                      <button type="button" onClick={() => void handleSubmitTransfer()} disabled={isSubmitting} className="w-full rounded-xl bg-emerald-700 py-4 font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400">
                        {isSubmitting ? "Confirming..." : "Confirm Transfer"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Saved Beneficiaries</h3>
                  <span className="text-sm font-medium text-emerald-700">{filteredBeneficiaries.length} saved</span>
                </div>
                <div className="space-y-3">
                  {filteredBeneficiaries.length ? (
                    filteredBeneficiaries.map((beneficiary) => (
                      <button
                        key={beneficiary.id}
                        type="button"
                        onClick={() => selectBeneficiary(beneficiary)}
                        className="flex w-full items-center gap-4 rounded-xl bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                          {beneficiary.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{beneficiary.name}</p>
                          <p className="text-sm text-slate-500">{beneficiary.phone} • {beneficiary.location}</p>
                        </div>
                        <span className="text-slate-400">→</span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No saved beneficiaries are available yet for this session.</div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Approval activity</h3>
              <span className="text-xs text-slate-400">Live servicing overlay</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Pending operator review</p>
                <p className="mt-2 text-2xl font-bold text-amber-950">{pendingApprovalTransfers.length}</p>
                <p className="mt-2 text-sm text-amber-800">Transfers that have been confirmed by the customer but are still awaiting branch approval.</p>
              </article>
              <article className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Completed in visible history</p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">{completedTransfers.length}</p>
                <p className="mt-2 text-sm text-emerald-800">Transfers already settled and reflected in the current recent-activity window.</p>
              </article>
            </div>
            <div className="mt-4 space-y-3">
              {pendingApprovalTransfers.length ? (
                pendingApprovalTransfers.map((transfer) => (
                  <article key={transfer.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{transfer.beneficiaryName}</p>
                        <p className="mt-1 text-sm text-amber-900">Awaiting branch approval after OTP confirmation.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        {transfer.approvalState?.replace("_", " ") ?? transfer.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-amber-900">
                      <span>Amount: {formatCurrency(transfer.amount)}</span>
                      <span>Submitted: {transfer.confirmedAt ? new Date(transfer.confirmedAt).toLocaleString() : new Date(transfer.createdAt).toLocaleString()}</span>
                      {transfer.workflowId ? <span>Workflow: {transfer.workflowId}</span> : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No transfer approvals are currently pending in the visible customer history.</div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Recent Transfers</h3>
              <span className="text-xs text-slate-400">Latest activity</span>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {recentCustomerTransfers.length ? (
                recentCustomerTransfers.map((transfer, index) => (
                  <article
                    key={transfer.id}
                    className={`flex items-center gap-4 p-4 ${index !== recentCustomerTransfers.length - 1 ? "border-b border-slate-100" : ""}`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${transfer.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                      <span>{transfer.status === "completed" ? "↓" : "↑"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{transfer.beneficiaryName}</p>
                      <p className="text-xs text-slate-500">
                        {transfer.confirmedAt ? new Date(transfer.confirmedAt).toLocaleString() : new Date(transfer.createdAt).toLocaleString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${transfer.status === "completed" ? "bg-emerald-100 text-emerald-700" : transfer.status === "submitted" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>
                          {transfer.status}
                        </span>
                        {transfer.approvalState ? (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${transfer.approvalState === "approved" ? "bg-emerald-100 text-emerald-700" : transfer.approvalState === "pending_review" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>
                            {transfer.approvalState.replace("_", " ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className={`shrink-0 font-semibold ${transfer.status === "completed" ? "text-emerald-700" : "text-rose-600"}`}>
                      {transfer.status === "completed" ? "+" : "-"}
                      {formatCurrency(transfer.amount)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="p-4 text-sm text-slate-500">No transfer history is visible yet.</div>
              )}
            </div>
          </section>
        </main>
      </div>

      <CustomerBottomNav />
    </div>
  );
}
