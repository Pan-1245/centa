import { redirect } from "next/navigation";
import { getOrCreateUserConfig } from "@/lib/actions";
import { SetupForm } from "@/components/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const config = await getOrCreateUserConfig();
  if (config) {
    redirect("/");
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Welcome to <span className="text-primary">Centa</span>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Choose a budget plan to get started, or create your own. You can
            always change it later.
          </p>
        </div>

        <SetupForm />
      </div>
    </div>
  );
}
