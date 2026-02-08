"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createCustomPlan,
  deleteBudgetPlan,
  setActiveBudgetPlan,
  updateBudgetPlan,
} from "@/lib/actions/budget";

type Plan = {
  id: string;
  name: string;
  isDefault: boolean;
  isCustom: boolean;
  categories: {
    id: string;
    name: string;
    percentage: number;
    isSavings: boolean;
  }[];
};

export function BudgetPlanList({
  plans,
  activePlanId,
}: {
  plans: Plan[];
  activePlanId: string;
}) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  return (
    <Tabs defaultValue="plans">
      <TabsList>
        <TabsTrigger value="plans">Budget Plans</TabsTrigger>
        <TabsTrigger value="custom">Custom Plan</TabsTrigger>
      </TabsList>

      <TabsContent value="plans" className="space-y-4">
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId;

          if (editingPlanId === plan.id) {
            return (
              <EditPlanForm
                key={plan.id}
                plan={plan}
                onCancel={() => setEditingPlanId(null)}
                onSaved={() => setEditingPlanId(null)}
              />
            );
          }

          return (
            <Card
              key={plan.id}
              className={isActive ? "border-primary" : undefined}
            >
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {plan.name}
                      {isActive && (
                        <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                          <Check className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="hidden sm:block">
                      {plan.categories
                        .map((c) => `${c.name} (${c.percentage}%)`)
                        .join(" / ")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPlanId(plan.id)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {!isActive && (
                      <form
                        action={async (formData: FormData) => {
                          await setActiveBudgetPlan(formData);
                        }}
                      >
                        <input type="hidden" name="planId" value={plan.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Use This Plan
                        </Button>
                      </form>
                    )}
                    {!isActive && plan.isCustom && (
                      <DeletePlanButton planId={plan.id} planName={plan.name} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {plan.categories.map((category) => (
                    <div
                      key={category.id}
                      className="bg-muted flex-1 rounded-md p-3 text-center"
                    >
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-2xl font-semibold">
                        {category.percentage}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="custom">
        <CustomPlanForm />
      </TabsContent>
    </Tabs>
  );
}

function EditPlanForm({
  plan,
  onCancel,
  onSaved,
}: {
  plan: Plan;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [categories, setCategories] = useState(
    plan.categories.map((c) => ({
      id: c.id,
      name: c.name,
      percentage: String(c.percentage),
      isSavings: c.isSavings,
    })),
  );

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      const result = await updateBudgetPlan(formData);
      if (result.success) {
        onSaved();
      }
      return result;
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
      {
        id: undefined as unknown as string,
        name: "",
        percentage: "",
        isSavings: false,
      },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Edit Plan</CardTitle>
        <CardDescription>
          Update the plan name, categories, and percentages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="planId" value={plan.id} />
          <input
            type="hidden"
            name="categories"
            value={JSON.stringify(
              categories.map((c) => ({
                id: c.id || undefined,
                name: c.name,
                percentage: parseFloat(c.percentage) || 0,
                isSavings: c.isSavings,
              })),
            )}
          />

          <div className="space-y-2">
            <label htmlFor="edit-plan-name" className="text-sm font-medium">
              Plan Name
            </label>
            <Input
              id="edit-plan-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Categories</label>
            {categories.map((cat, i) => (
              <div
                key={cat.id || `new-${i}`}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:border-0 sm:p-0"
              >
                <Input
                  placeholder="Category name"
                  value={cat.name}
                  onChange={(e) => updateCategory(i, "name", e.target.value)}
                  required
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="%"
                    className="w-20 sm:w-24"
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
                      className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0 p-0"
                      onClick={() => removeCategory(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

          <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm">
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
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={pending || Math.abs(total - 100) > 0.01}
            >
              {pending ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CustomPlanForm() {
  const [categories, setCategories] = useState([
    { name: "", percentage: "", isSavings: false },
    { name: "", percentage: "", isSavings: false },
  ]);

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      const result = await createCustomPlan(formData);
      if (result.success) {
        setCategories([
          { name: "", percentage: "", isSavings: false },
          { name: "", percentage: "", isSavings: false },
        ]);
      }
      return result;
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
        <CardTitle>Create Custom Plan</CardTitle>
        <CardDescription>
          Define your own budget categories and percentages.
        </CardDescription>
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
              placeholder="My Custom Plan"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Categories</label>
            {categories.map((cat, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:border-0 sm:p-0"
              >
                <Input
                  placeholder="Category name"
                  value={cat.name}
                  onChange={(e) => updateCategory(i, "name", e.target.value)}
                  required
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="%"
                    className="w-20 sm:w-24"
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
                      className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0 p-0"
                      onClick={() => removeCategory(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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

          <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm">
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
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <Button
            type="submit"
            disabled={pending || Math.abs(total - 100) > 0.01}
          >
            {pending ? "Creating..." : "Create Plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DeletePlanButton({
  planId,
  planName,
}: {
  planId: string;
  planName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      const result = await deleteBudgetPlan(formData);
      if (result.success) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{planName}&rdquo;?</DialogTitle>
          <DialogDescription>
            This will permanently delete this plan. Transactions using its
            categories will lose their category assignment.
          </DialogDescription>
        </DialogHeader>
        {state?.error && (
          <p className="text-destructive text-sm">{state.error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="planId" value={planId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete Plan"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
