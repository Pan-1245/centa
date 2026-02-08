import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SummaryLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-56 animate-pulse rounded" />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="bg-muted h-6 w-16 animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="bg-muted h-12 w-full animate-pulse rounded"
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
