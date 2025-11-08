import { redirect } from "next/navigation";

export const metadata = {
  title: "Cost Catalogue",
  description: "This catalogue has been unified into the Usage & Costs dashboard.",
};

export const dynamic = "force-dynamic";

export default function CostCataloguePage() {
  redirect("/dashboard/usage");
}
