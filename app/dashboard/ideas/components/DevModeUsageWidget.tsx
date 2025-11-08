"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DevModeUsageWidget() {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArrowUpRight className="size-4" /> Usage & costs live in one place now
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Monitor Dev Mode minutes, credit balances, and per-action costs from the unified dashboard instead of scattered widgets.
        </p>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/dashboard/usage">
            Open Usage & Costs
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
