import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-64 animate-pulse rounded" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-muted border-l-4">
            <CardHeader className="pb-2">
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-7 w-32 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="bg-muted h-3 w-36 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="bg-muted h-6 w-40 animate-pulse rounded" />
          <div className="bg-muted mt-2 h-4 w-72 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              </div>
              <div className="bg-muted h-2 w-full animate-pulse rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
