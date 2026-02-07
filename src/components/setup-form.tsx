"use client";

import { useState, useActionState } from "react";
import { initializeApp, initializeWithCustomPlan } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, X, ArrowLeft, LayoutTemplate, PenLine } from "lucide-react";

const presetPlans = [
  {
    name: "50 / 30 / 20",
    description: "A balanced approach for most people.",
    categories: [
      { name: "Needs", percentage: 50, isSavings: false },
      { name: "Wants", percentage: 30, isSavings: false },
      { name: "Savings", percentage: 20, isSavings: true },
    ],
  },
  {
    name: "70 / 20 / 10",
    description: "Prioritize essentials with modest savings.",
    categories: [
      { name: "Essentials", percentage: 70, isSavings: false },
      { name: "Leisure", percentage: 20, isSavings: false },
      { name: "Savings", percentage: 10, isSavings: true },
    ],
  },
];

type View = "choice" | "presets" | "custom";

export function SetupForm() {
  const [view, setView] = useState<View>("choice");

  if (view === "custom") {
    return <CustomPlanSetup onBack={() => setView("choice")} />;
  }

  if (view === "presets") {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => setView("choice")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {presetPlans.map((plan, index) => (
          <Card
            key={plan.name}
            className="border-l-4 border-l-primary/60 transition-shadow hover:shadow-md"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <form
                  action={async (formData: FormData) => {
                    await initializeApp(formData);
                  }}
                >
                  <input type="hidden" name="planIndex" value={index} />
                  <Button type="submit">Get started</Button>
                </form>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {plan.categories.map((category) => (
                  <div
                    key={category.name}
                    className="flex-1 rounded-md bg-primary/5 p-3 text-center"
                  >
                    <p className="text-sm font-medium">{category.name}</p>
                    <p className="text-2xl font-semibold text-primary">
                      {category.percentage}%
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card
          className="cursor-pointer border-dashed transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-md"
          onClick={() => setView("custom")}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Create your own</CardTitle>
                <CardDescription>
                  Changed your mind? Define custom categories instead.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card
        className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
        onClick={() => setView("presets")}
      >
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LayoutTemplate className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Use a preset</CardTitle>
          <CardDescription>
            Pick from popular budget templates and start right away.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
        onClick={() => setView("custom")}
      >
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <PenLine className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Create your own</CardTitle>
          <CardDescription>
            Define custom categories and percentages that fit your needs.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function CustomPlanSetup({ onBack }: { onBack: () => void }) {
  const [categories, setCategories] = useState([
    { name: "", percentage: "", isSavings: false },
    { name: "", percentage: "", isSavings: false },
  ]);

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      return await initializeWithCustomPlan(formData);
    },
    null,
  );

  const total = categories.reduce(
    (sum, c) => sum + (parseFloat(c.percentage) || 0),
    0,
  );

  const updateCategory = (
    index: number,
    field: "name" | "percentage",
    value: string,
  ) => {
    setCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  };

  const toggleSavings = (index: number) => {
    setCategories((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSavings: !c.isSavings } : c)),
    );
  };

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      { name: "", percentage: "", isSavings: false },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>Create your own plan</CardTitle>
            <CardDescription>
              Define your budget categories and how much of your income goes to
              each.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input
            type="hidden"
            name="categories"
            value={JSON.stringify(
              categories.map((c) => ({
                name: c.name,
                percentage: parseFloat(c.percentage) || 0,
                isSavings: c.isSavings,
              })),
            )}
          />

          <div className="space-y-2">
            <label htmlFor="plan-name" className="text-sm font-medium">
              Plan Name
            </label>
            <Input
              id="plan-name"
              name="name"
              placeholder="My Budget Plan"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Categories</label>
            {categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Category name"
                  value={cat.name}
                  onChange={(e) => updateCategory(i, "name", e.target.value)}
                  required
                />
                <Input
                  type="number"
                  placeholder="%"
                  className="w-24"
                  value={cat.percentage}
                  onChange={(e) =>
                    updateCategory(i, "percentage", e.target.value)
                  }
                  min="1"
                  max="100"
                  required
                />
                <Button
                  type="button"
                  variant={cat.isSavings ? "default" : "outline"}
                  size="sm"
                  className="h-9 shrink-0 text-xs"
                  onClick={() => toggleSavings(i)}
                >
                  Savings
                </Button>
                {categories.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCategory(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCategory}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span>Total</span>
            <span
              className={
                Math.abs(total - 100) < 0.01
                  ? "font-medium text-green-600 dark:text-green-400"
                  : "font-medium text-red-600 dark:text-red-400"
              }
            >
              {total}%
            </span>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || Math.abs(total - 100) > 0.01}
          >
            {pending ? "Creating..." : "Create plan and get started"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
