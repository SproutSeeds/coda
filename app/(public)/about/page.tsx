import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";

import { LoginExperience } from "../login/components/LoginExperience";
import { LoginHero } from "../login/components/LoginHero";

export const metadata: Metadata = {
  title: "About",
  description: "A notes app that never lets you down.",
};

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginHero />
      <LoginExperience initialTab="about" isAuthenticated={Boolean(user)} />
    </div>
  );
}
