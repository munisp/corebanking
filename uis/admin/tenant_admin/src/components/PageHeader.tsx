import type { ReactNode } from "react";
import { useTenantBranding } from "../contexts/TenantBrandingContext";

interface PageHeaderProps {
  label: string;
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
  };
}

export default function PageHeader({
  label,
  title,
  description,
  icon,
  action,
}: PageHeaderProps) {
  const { primaryColor, secondaryColor } = useTenantBranding();

  return (
    <div
      className="rounded-2xl px-8 py-8"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          {icon && <div className="text-white mt-1">{icon}</div>}
          <div className="flex-1">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
              {label}
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              {title}
            </h1>
            <p className="text-white/70 text-sm font-medium max-w-xl">
              {description}
            </p>
          </div>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-medium hover:bg-white/20 transition-all backdrop-blur-sm whitespace-nowrap flex-shrink-0"
          >
            {action.label} →
          </button>
        )}
      </div>
    </div>
  );
}
