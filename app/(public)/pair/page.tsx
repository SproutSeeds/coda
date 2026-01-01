import { getCurrentUser } from "@/lib/auth/session";
import { PairAuthorize } from "./pair-authorize";

export default async function PairPage() {
  const user = await getCurrentUser();

  return (
    <PairAuthorize
      isSignedIn={Boolean(user)}
      userEmail={user?.email ?? undefined}
      userName={user?.name ?? undefined}
    />
  );
}
