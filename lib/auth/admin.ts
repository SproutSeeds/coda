import { redirect } from "next/navigation";
import { requireUser } from "./session";

// Admin emails - in production, this should be stored in a database or env var
const ADMIN_EMAILS = [
    "codyshanemitchell@gmail.com",
    "cody@codacli.com",
];

export async function isAdmin(email?: string | null): Promise<boolean> {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requirePlatformAdmin(): Promise<{ id: string; email: string }> {
    const user = await requireUser();
    if (!user.email || !await isAdmin(user.email)) {
        redirect("/dashboard");
    }
    return { id: user.id, email: user.email };
}
