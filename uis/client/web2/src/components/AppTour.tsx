import { useCallback, useEffect, useState } from "react";
import Joyride, { STATUS} from "react-joyride";
import type { CallBackProps, Step, TooltipRenderProps } from "react-joyride";

const TOUR_KEY = "web2_banking_tour_v1";

const STEPS: Step[] = [
  {
    target: "body",
    content: (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Welcome to Your Banking App</h2>
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          This quick tour covers the key features available to you. You can restart it anytime using the guide button in the navigation bar.
        </p>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour='nav-bar']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Navigation Bar</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Your main navigation — access all features from here. Use "More Actions" on desktop to browse the full feature menu.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Transfers & Payments</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Send money, pay bills, write cheques, and handle foreign exchange — all available inside the feature menu.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Savings & Investments</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Set savings goals, manage fixed deposits, and grow your portfolio with investment and pension products.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Loans & Credit</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Apply for personal, mortgage, education, and agricultural loans. Track your active loans and repayment schedule.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Cards & QR Payments</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Manage your debit and virtual cards, generate QR codes for payments, and view card transaction history.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Disputes & Support</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Raise transaction disputes, track case status, and get help with any issues on your account quickly.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-more-actions']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Transaction History & Settings</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Review your full transaction history with filters and export options. Manage your profile, notifications, and security settings.</p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: "[data-tour='tour-help']",
    content: (
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Restart This Tour</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Click this button anytime to replay the guide. You're all set — enjoy your banking experience!</p>
      </div>
    ),
    placement: "bottom",
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
            Banking Guide
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
  const handleCallback = useCallback(
    (data: CallBackProps) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        localStorage.setItem(TOUR_KEY, "true");
        onFinish();
      }
    },
    [onFinish],
  );

  return (
    <Joyride
      steps={STEPS}
      run={run}
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
      const t = setTimeout(() => setRun(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const startTour = useCallback(() => setRun(true), []);
  const stopTour = useCallback(() => setRun(false), []);

  return { run, startTour, stopTour };
}
