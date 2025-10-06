"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [isPending, startTransition] = useTransition();

  const updateQuery = useDebouncedCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    params.delete("cursor");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }, 250);

  const clear = () => {
    updateQuery.cancel();
    startTransition(() => {
      router.replace(pathname);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        data-testid="ideas-search-input"
        placeholder="Search ideas"
        defaultValue={query}
        onChange={(event) => updateQuery(event.target.value)}
      />
      {query ? (
        <Button variant="ghost" size="sm" onClick={clear} disabled={isPending}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
