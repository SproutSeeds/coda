import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function UpgradePage() {
  redirect("/dashboard/billing");
}
