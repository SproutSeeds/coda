import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <PasswordManager hasPassword={passwordSet} />
    </div>
  );
}
