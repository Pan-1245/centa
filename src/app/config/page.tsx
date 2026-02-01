import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const defaultPlans = [
  {
    name: "50 / 30 / 20",
    categories: [
      { name: "Needs", percentage: 50 },
      { name: "Wants", percentage: 30 },
      { name: "Savings", percentage: 20 },
    ],
  },
  {
    name: "70 / 20 / 10",
    categories: [
      { name: "Essentials", percentage: 70 },
      { name: "Leisure", percentage: 20 },
      { name: "Savings", percentage: 10 },
    ],
  },
  {
    name: "80 / 20",
    categories: [
      { name: "Spending", percentage: 80 },
      { name: "Savings", percentage: 20 },
    ],
  },
];

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Choose your budget plan or create a custom one.
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Budget Plans</TabsTrigger>
          <TabsTrigger value="custom">Custom Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {defaultPlans.map((plan) => (
            <Card key={plan.name}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {plan.categories
                    .map((c) => `${c.name} (${c.percentage}%)`)
                    .join(" / ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {plan.categories.map((category) => (
                    <div
                      key={category.name}
                      className="flex-1 rounded-md bg-muted p-3 text-center"
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
          ))}
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Create Custom Plan</CardTitle>
              <CardDescription>
                Define your own budget categories and percentages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Custom plan builder coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
