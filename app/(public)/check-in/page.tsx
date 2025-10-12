import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/session";

import { LoginExperience } from "../login/components/LoginExperience";
import { LoginHero } from "../login/components/LoginHero";

export const metadata: Metadata = {
  title: "Meetup Check-in",
  description: "Experience the animated meetup flow and keep your attendance streak alive.",
};

export default async function CheckInPage() {
  const user = await getCurrentUser();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginHero />
      <LoginExperience initialTab="meetup" isAuthenticated={Boolean(user)} />
    </div>
  );
}
