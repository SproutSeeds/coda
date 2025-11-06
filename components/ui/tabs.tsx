"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string | null;
  setValue: (next: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

type TabsProps = React.PropsWithChildren<{
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}>;

function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue ?? null);

  const currentValue = (isControlled ? value : internalValue) ?? null;

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabsListProps = React.ComponentPropsWithoutRef<"div">;

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(function TabsList({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="tablist"
      className={cn("inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  );
});

type TabsTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  value: string;
};

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { value, className, children, ...props },
  ref,
) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within a Tabs component");
  }

  const isActive = context.value === value;

  return (
    <button
      ref={ref}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`tabs-content-${value}`}
      onClick={() => context.setValue(value)}
      className={cn(
        "inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "bg-background text-foreground shadow" : undefined,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

type TabsContentProps = React.ComponentPropsWithoutRef<"div"> & {
  value: string;
};

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
  { value, className, children, ...props },
  ref,
) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within a Tabs component");
  }

  const hidden = context.value !== value;

  return (
    <div
      ref={ref}
      id={`tabs-content-${value}`}
      role="tabpanel"
      hidden={hidden}
      className={cn("mt-3", className)}
      {...props}
    >
      {!hidden ? children : null}
    </div>
  );
});

export { Tabs, TabsContent, TabsList, TabsTrigger };
