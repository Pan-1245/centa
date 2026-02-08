import { redirect } from "next/navigation";

import { BudgetPlanList } from "@/components/budget/budget-plan-list";
import { getBudgetPlans } from "@/lib/actions/budget";
import { getOrCreateUserConfig } from "@/lib/actions/config";

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
