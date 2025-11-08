import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getUserMeetupAttendance } from "@/lib/db/meetup";
import { clearThemePreference, getThemePreference } from "@/lib/db/theme-preferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PasswordManager } from "./components/PasswordManager";
import { ThemePreferenceSection } from "./components/ThemePreferenceSection";
import { hasPassword } from "./actions";

export const metadata = {
  title: "Account Settings",
};

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = (searchParams ? await searchParams : {}) ?? {};

  const resetParam = Array.isArray(params.themeTestReset) ? params.themeTestReset[0] : params.themeTestReset;
  if (resetParam && process.env.NODE_ENV !== "production") {
    await clearThemePreference(user.id);
    const cookieStore = await cookies();
    cookieStore.delete("coda-theme");
  }

  const passwordSet = await hasPassword(user.id);
  const attendance = await getUserMeetupAttendance(user.id);
  const themePreference = await getThemePreference(user.id);
  const showOnboardingPrompt = !themePreference || !themePreference.promptDismissedAt;
  const initialTheme = themePreference?.theme ?? "dark";
  const attendanceFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <ThemePreferenceSection initialTheme={initialTheme} showOnboarding={showOnboardingPrompt} />
      <PasswordManager hasPassword={passwordSet} />
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Meetings attended</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tally: <span className="font-semibold text-foreground">{attendance.length}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins yet. Catch us Saturdays 11 AM – 1 PM CST to start your streak.</p>
          ) : (
            <ol className="space-y-2 text-sm text-muted-foreground">
              {attendance.map((entry, index) => {
                // Only render if we have a valid timestamp to prevent hydration mismatches
                if (!entry.createdAt) return null;

                return (
                  <li key={entry.id ?? `${index}-${entry.createdAt}`} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2">
                    <span className="font-medium text-foreground">Meeting #{attendance.length - index}</span>
                    <span>{attendanceFormatter.format(entry.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
