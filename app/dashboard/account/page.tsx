import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getUserMeetupAttendance } from "@/lib/db/meetup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PasswordManager } from "./components/PasswordManager";
import { hasPassword } from "./actions";

export const metadata = {
  title: "Account Settings",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const passwordSet = await hasPassword(user.id);
  const attendance = await getUserMeetupAttendance(user.id);
  const attendanceFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <PasswordManager hasPassword={passwordSet} />
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Meetup attendance</CardTitle>
          <p className="text-sm text-muted-foreground">
            You{attendance.length === 0 ? " haven’t" : "’ve"} checked in to {attendance.length} meetup{attendance.length === 1 ? "" : "s"}.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">Check in between 11am – 1pm CST on Saturdays to start earning rewards.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {attendance.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2">
                  <span className="font-medium text-foreground">Meetup</span>
                  <span>{attendanceFormatter.format(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
