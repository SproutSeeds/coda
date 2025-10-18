import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";

import { LoginExperience } from "../login/components/LoginExperience";
import { LoginHero } from "../login/components/LoginHero";

export const metadata: Metadata = {
  title: "About Coda",
  description: "A notes app that never lets you down.",
};

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginHero />
      <LoginExperience
        initialTab="about"
        isAuthenticated={Boolean(user)}
        cardContainerClassName="pb-20 sm:pb-28"
      />
    </div>
  );
}
