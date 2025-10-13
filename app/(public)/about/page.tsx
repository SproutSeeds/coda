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
    <div className="relative min-h-screen overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <LoginHero />
      <LoginExperience
        initialTab="about"
        isAuthenticated={Boolean(user)}
        cardScale={0.78}
        cardOffsetY={-48}
        cardContainerClassName="max-w-none"
        cardContainerStyle={{
          maxWidth: "min(100%, clamp(36rem, 70vw, 80rem))",
        }}
      />
    </div>
  );
}
