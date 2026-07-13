import AdminWorkspaceLayout from "@/components/AdminWorkspaceLayout";
import PricingModelTool from "@/components/PricingModelTool";

export default function PricingModelWorkspace() {
  return (
    <AdminWorkspaceLayout
      eyebrow="Commercial modelling workspace"
      title="Platform Pricing Model"
      description="Use the live financial model to tune licence, implementation, recurring support, and scope-expansion assumptions before turning platform commercials into a proposal or internal approval pack."
    >
      <div className="space-y-6 p-6 lg:p-8">
        <section className="rounded-[1.8rem] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Commercial controls</p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">Scenario-based pricing workspace</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              This workspace turns the Mutual Benefits pricing structure into a reusable calculator so commercial teams can
              compare Year 1 delivery cost, recurring revenue, and overage exposure under different deployment envelopes.
            </p>
          </div>
        </section>

        <PricingModelTool />
      </div>
    </AdminWorkspaceLayout>
  );
}
