import { useCallback, useEffect, useState } from "react";
import Joyride, { STATUS, EVENTS, ACTIONS } from "react-joyride";
import type { CallBackProps, Step, TooltipRenderProps } from "react-joyride";

const TOUR_KEY = "tenant_admin_tour_v1";

const STEPS: Step[] = [
  {
    target: "body",
    content: (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Welcome to the Admin Console</h2>
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          This quick tour walks you through every section of the sidebar. You can restart it anytime using the Guide Tour button at the bottom.
        </p>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour='section-overview']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Overview</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Your dashboard — account summaries, transaction volumes, loan pipeline, and key performance indicators for your branch.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-customers-relationships']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Customers & Relationships</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Manage customers, employees, businesses, institutions, and communication. Centralises all your customer-facing operations.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-core-banking']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Core Banking</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Account opening and closure, statements, virtual accounts, teller operations, branch management, and end-of-day processing.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-payments-transfers']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Payments & Transfers</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>All payment channels — transfers, bulk payments, NIBSS direct debit, SWIFT, ISO 20022, wire transfers, and payment investigation.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-cards-channels']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Cards & Channels</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Manage card issuance, ATMs, POS terminals, card fraud rules, and agent banking channels.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-lending-credit']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Lending & Credit</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Loan origination, credit scoring, credit bureau checks, mortgages, leasing, BNPL, and group lending products.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-savings-wealth']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Savings & Wealth</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Savings accounts, investments, pension, wealth and portfolio management, trust & estate, and escrow services.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-specialized-banking']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Specialized Banking</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Agriculture banking, Islamic banking, education banking, diaspora banking, esusu, and cooperative management.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-treasury-markets']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Treasury & Markets</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>FX dealing, liquidity management, money markets, interbank lending, securities trading, and OTC derivatives.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-trade-finance']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Trade Finance</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Letters of credit, bank guarantees, export factoring, supply chain finance, and LPO financing.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-risk-compliance']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Risk & Compliance</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>AML, fraud detection, sanctions screening, NDPR compliance, regulatory reporting, IFRS 9, Basel engine, and dispute management.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-finance-accounting']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Finance & Accounting</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Billing, chart of accounts, GL accounts, fee management, interest rates, expense management, and ERP integration.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-workflow-automation']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Workflow & Automation</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Approval workflows, workflow engine, maker-checker controls, and document management.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-developer-platform']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Developer Platform</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>API keys, OAuth app registration, webhook engine, and sandbox environment for integration testing.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-notifications']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Notifications</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Notification centre and preferences — configure how and when alerts are delivered across your institution.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-analytics-monitoring']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Analytics & Monitoring</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>System monitoring, usage analytics, KPI dashboards, and full audit logs for regulatory compliance.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='section-administration']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Administration</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Manage admin accounts, assign roles and permissions, handle temporal access grants, and review your own access.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "[data-tour='tour-help']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Restart This Tour</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Click here anytime to replay this guide. You're all set — happy banking!</p>
      </div>
    ),
    placement: "top",
    disableBeacon: true,
  },
];

function CustomTooltip({ continuous, index, step, backProps, primaryProps, skipProps, tooltipProps, size }: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      style={{
        maxWidth: 340,
        borderRadius: 14,
        padding: 0,
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
        background: "white",
      }}
    >
      <div style={{ background: "linear-gradient(135deg, #004F71 0%, #003047 100%)", padding: "12px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#6CC049", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
            Admin Guide
          </span>
          <button
            {...skipProps}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}
          >
            Skip
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>{step.content}</div>

      <div style={{ background: "#F9FAFB", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #E5E7EB" }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{index + 1} / {size}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && (
            <button
              {...backProps}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", color: "#374151", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
            >
              Back
            </button>
          )}
          <button
            {...primaryProps}
            style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #004F71, #003047)", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            {continuous ? (index === size - 1 ? "Finish" : "Next") : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppTour({ run, onFinish }: { run: boolean; onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, action, index } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(TOUR_KEY, "true");
        setStepIndex(0);
        onFinish();
        return;
      }

      // Advance past steps whose section is hidden by feature flags/permissions
      if (type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      }
    },
    [onFinish],
  );

  return (
    <Joyride
      steps={STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      showSkipButton
      disableOverlayClose
      spotlightClicks={false}
      tooltipComponent={CustomTooltip}
      styles={{
        options: {
          zIndex: 10000,
          overlayColor: "rgba(0, 79, 113, 0.45)",
          arrowColor: "white",
        },
        spotlight: { borderRadius: 8 },
      }}
      callback={handleCallback}
    />
  );
}

export function useTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      try {
        const authUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
        if (authUser.is_verified === false) return;
      } catch {}
      const t = setTimeout(() => setRun(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const startTour = useCallback(() => setRun(true), []);
  const stopTour = useCallback(() => setRun(false), []);

  return { run, startTour, stopTour };
}
