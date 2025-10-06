import { redirect } from "next/navigation";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

import { DevLoginForm } from "./components/DevLoginForm";
import { EmailSignInForm } from "./components/EmailSignInForm";
import { GitHubSignInButton } from "./components/GitHubSignInButton";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard/ideas");
  }

  const enableDevLogin = process.env.ENABLE_DEV_LOGIN === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Coda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in with a one-time magic link or continue with GitHub.
            </p>
            <EmailSignInForm />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Or continue with</p>
            <GitHubSignInButton />
          </div>
        </CardContent>
        {enableDevLogin ? (
          <CardFooter className="border-t bg-muted/40">
            <DevLoginForm />
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
