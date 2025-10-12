import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";

import { LoginExperience } from "../login/components/LoginExperience";
import { LoginHero } from "../login/components/LoginHero";

export const metadata: Metadata = {
  title: "About",
  description: "Step into the CODA experience and learn how the workspace keeps shipping calm.",
};

const enableDevLogin = process.env.ENABLE_DEV_LOGIN === "true";

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginHero />
      <LoginExperience enableDevLogin={enableDevLogin} initialTab="about" isAuthenticated={Boolean(user)} />
    </div>
  );
}
