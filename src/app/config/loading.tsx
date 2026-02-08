import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ConfigLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-64 animate-pulse rounded" />
      </div>

      <Card>
        <CardHeader>
          <div className="bg-muted h-6 w-32 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-muted h-16 w-full animate-pulse rounded"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
