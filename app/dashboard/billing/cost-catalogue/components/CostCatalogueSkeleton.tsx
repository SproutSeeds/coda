import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CostCatalogueSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="h-5 w-32 animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="border-border/70 bg-card/95">
            <CardHeader className="space-y-2">
              <CardTitle className="h-5 w-36 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
              <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
