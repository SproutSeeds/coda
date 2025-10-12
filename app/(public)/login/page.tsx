import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

import { LoginHero } from "./components/LoginHero";
import { LoginExperience } from "./components/LoginExperience";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard/ideas");
  }

  const params = await searchParams;
  const tabParam = params?.tab;
  const tab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const initialTab = tab === "meetup" || tab === "about" ? (tab as "meetup" | "about") : "sign-in";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginHero />
      <LoginExperience initialTab={initialTab} />
    </div>
  );
}
