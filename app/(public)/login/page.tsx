import { redirect } from "next/navigation";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

import { DevLoginForm } from "./components/DevLoginForm";
import { SignInSwitcher } from "./components/SignInSwitcher";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard/ideas");
  }

  const enableDevLogin = process.env.ENABLE_DEV_LOGIN === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-md border-border/80 shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-semibold">Sign in to Coda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 border-t border-border/60 px-6 py-8">
          <SignInSwitcher />
        </CardContent>
        {enableDevLogin ? (
          <CardFooter className="border-t border-border/60 bg-muted/60 px-6 py-5">
            <DevLoginForm />
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
