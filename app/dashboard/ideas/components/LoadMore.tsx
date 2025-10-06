"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LoadMore({ cursor }: { cursor: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.set("cursor", cursor);

  return (
    <div className="flex justify-center">
      <Button variant="outline" asChild>
        <Link href={`${pathname}?${params.toString()}`}>Load more</Link>
      </Button>
    </div>
  );
}
