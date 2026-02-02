import { redirect } from "next/navigation";
import { getBudgetPlans, getOrCreateUserConfig } from "@/lib/actions";
import { BudgetPlanList } from "@/components/budget-plan-list";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const [plans, config] = await Promise.all([
    getBudgetPlans(),
    getOrCreateUserConfig(),
  ]);

  if (!config) redirect("/setup");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Choose your budget plan or create a custom one.
        </p>
      </div>

      <BudgetPlanList plans={plans} activePlanId={config.activePlanId} />
    </div>
  );
}
