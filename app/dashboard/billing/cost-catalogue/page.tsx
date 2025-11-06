import { Suspense } from "react";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  getCostCatalogueAllowances,
  getCostCatalogueMatrix,
  type CostCatalogueAllowances,
  type CostCatalogueMatrix,
} from "@/lib/limits/catalogue";

import { CostCatalogueClient } from "./components/CostCatalogueClient";
import { CostCatalogueSkeleton } from "./components/CostCatalogueSkeleton";

export const metadata = {
  title: "Cost Catalogue",
};

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type CostCataloguePageProps = {
  searchParams?: PageSearchParams;
};

export default async function CostCataloguePage({ searchParams }: CostCataloguePageProps) {
  const user = await requireUser();
  if (!user) {
    redirect("/login");
  }

  const params = (searchParams ? await searchParams : {}) ?? {};
  const matrix = await getCostCatalogueMatrix();
  const initialFilters = resolveFilterState(params, matrix);
  const allowancesPromise = getCostCatalogueAllowances(user.id);

  return (
    <Suspense fallback={<CostCatalogueSkeleton />}>
      <AllowancesBoundary matrix={matrix} filters={initialFilters} allowancesPromise={allowancesPromise} />
    </Suspense>
  );
}

type FilterState = {
  tab: "category" | "vendor" | "plan";
  category: string | null;
  vendor: string | null;
  plan: string | null;
};

function resolveFilterState(params: Record<string, string | string[] | undefined>, matrix: CostCatalogueMatrix): FilterState {
  const tabParam = normalizeParam(params.tab);
  const categoryParam = normalizeParam(params.category);
  const vendorParam = normalizeParam(params.vendor);
  const planParam = normalizeParam(params.plan);

  const tab: FilterState["tab"] = tabParam === "vendor" || tabParam === "plan" ? tabParam : "category";

  const validCategory = matrix.categories.some((category) => category.id === categoryParam) ? categoryParam : null;
  const validVendor = matrix.actions.some((action) => action.vendor === vendorParam) ? vendorParam : null;
  const validPlan = matrix.plans.some((plan) => plan.id === planParam) ? planParam : null;

  return {
    tab,
    category: validCategory,
    vendor: validVendor,
    plan: validPlan,
  };
}

function normalizeParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

type AllowancesBoundaryProps = {
  matrix: CostCatalogueMatrix;
  filters: FilterState;
  allowancesPromise: Promise<CostCatalogueAllowances>;
};

async function AllowancesBoundary({ matrix, filters, allowancesPromise }: AllowancesBoundaryProps) {
  let allowances: CostCatalogueAllowances | null = null;
  try {
    allowances = await allowancesPromise;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("cost-catalogue: failed to load allowance snapshot", error);
    }
  }
  return <CostCatalogueClient matrix={matrix} allowances={allowances} initialFilters={filters} />;
}
