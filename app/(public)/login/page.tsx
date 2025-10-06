import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";

import { loginAction } from "./actions";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard/ideas");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Coda</CardTitle>
        </CardHeader>
        <form action={loginAction}>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Coda uses pre-provisioned identities for the MVP. Enter a known user id to continue.
            </p>
            <Input name="userId" placeholder="owner-token" required />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
