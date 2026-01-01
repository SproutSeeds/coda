"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Monitor, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AUTH_PRIMARY_BUTTON_STYLE =
  "interactive-btn border-none bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.5)] transition-shadow duration-300 hover:shadow-[0_0_26px_rgba(251,191,36,0.7)] focus-visible:ring-2 focus-visible:ring-yellow-300/70 focus-visible:ring-offset-0 disabled:opacity-70 disabled:cursor-not-allowed";

type PairStatus = "loading" | "ready" | "authorizing" | "success" | "expired" | "error" | "no_code";

type PairingInfo = {
  deviceCode: string;
  deviceName?: string;
  expiresAt?: string;
};

type Props = {
  isSignedIn: boolean;
  userEmail?: string;
  userName?: string;
};

export function PairAuthorize({ isSignedIn, userEmail }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const deviceCode = searchParams.get("device_code");

  const [status, setStatus] = useState<PairStatus>("loading");
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check pairing status on mount
  useEffect(() => {
    if (!deviceCode) {
      setStatus("no_code");
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/pair/status?device_code=${deviceCode}`);
        const data = await res.json();

        if (res.status === 404) {
          setStatus("error");
          setError("This authorization link is invalid.");
          return;
        }

        if (data.status === "expired") {
          setStatus("expired");
          return;
        }

        if (data.status === "authorized") {
          setStatus("success");
          return;
        }

        if (data.status === "pending") {
          setPairingInfo({ deviceCode, deviceName: data.deviceName });
          setStatus("ready");
          return;
        }

        setStatus("error");
        setError("Unknown pairing status");
      } catch {
        setStatus("error");
        setError("Failed to check pairing status");
      }
    };

    checkStatus();
  }, [deviceCode]);

  const handleAuthorize = async () => {
    if (!deviceCode) return;

    setStatus("authorizing");
    try {
      const res = await fetch("/api/pair/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setStatus("expired");
          return;
        }
        setStatus("error");
        setError(data.error || "Failed to authorize device");
        return;
      }

      setPairingInfo((prev) => prev ? { ...prev, deviceName: data.deviceName } : null);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Failed to authorize device");
    }
  };

  // If not signed in, redirect to login with callback
  if (!isSignedIn) {
    const callbackUrl = `/pair?device_code=${deviceCode}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-400/10">
              <Monitor className="size-8 text-amber-400" />
            </div>
            <CardTitle className="text-xl text-white">Authorize Device</CardTitle>
            <CardDescription className="text-slate-300">
              Sign in to authorize this device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-slate-400">
              You need to sign in to your account before you can authorize this device.
            </p>
            <Button asChild className={cn(AUTH_PRIMARY_BUTTON_STYLE, "w-full")}>
              <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                Sign in to continue
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl">
        {status === "loading" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-400/10">
                <Loader2 className="size-8 animate-spin text-amber-400" />
              </div>
              <CardTitle className="text-xl text-white">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-slate-400">
                Checking authorization request...
              </p>
            </CardContent>
          </>
        )}

        {status === "no_code" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-400/10">
                <XCircle className="size-8 text-red-400" />
              </div>
              <CardTitle className="text-xl text-white">No Device Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-slate-400">
                This page requires a device code. Please start the pairing process from your Coda Home Server app.
              </p>
              <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <Link href="/dashboard/ideas">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}

        {status === "ready" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-400/10">
                <Monitor className="size-8 text-amber-400" />
              </div>
              <CardTitle className="text-xl text-white">Authorize Device</CardTitle>
              <CardDescription className="text-slate-300">
                {pairingInfo?.deviceName || "A device"} wants to connect to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="mb-2 text-sm font-medium text-white">This will allow the app to:</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-400" />
                    Access your ideas and features
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-400" />
                    Sync data between devices
                  </li>
                </ul>
              </div>

              <div className="text-center text-sm text-slate-400">
                Signed in as <span className="font-medium text-white">{userEmail}</span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                  onClick={() => router.push("/dashboard/ideas")}
                >
                  Cancel
                </Button>
                <Button
                  className={cn(AUTH_PRIMARY_BUTTON_STYLE, "flex-1")}
                  onClick={handleAuthorize}
                >
                  Authorize Device
                </Button>
              </div>

              <p className="text-center text-xs text-slate-500">
                Not you?{" "}
                <Link href="/login" className="text-amber-400 hover:underline">
                  Sign in with a different account
                </Link>
              </p>
            </CardContent>
          </>
        )}

        {status === "authorizing" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-400/10">
                <Loader2 className="size-8 animate-spin text-amber-400" />
              </div>
              <CardTitle className="text-xl text-white">Authorizing...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-slate-400">
                Please wait while we authorize this device.
              </p>
            </CardContent>
          </>
        )}

        {status === "success" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-400/10">
                <CheckCircle2 className="size-8 text-green-400" />
              </div>
              <CardTitle className="text-xl text-white">Device Authorized!</CardTitle>
              <CardDescription className="text-slate-300">
                {pairingInfo?.deviceName || "Your device"} is now connected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-slate-400">
                You can close this tab and return to your Coda Home Server app.
              </p>
              <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <Link href="/dashboard/ideas">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}

        {status === "expired" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-orange-400/10">
                <XCircle className="size-8 text-orange-400" />
              </div>
              <CardTitle className="text-xl text-white">Link Expired</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-slate-400">
                This authorization link has expired. Please start a new pairing request from your Coda Home Server app.
              </p>
              <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <Link href="/dashboard/ideas">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}

        {status === "error" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-400/10">
                <XCircle className="size-8 text-red-400" />
              </div>
              <CardTitle className="text-xl text-white">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-slate-400">
                {error || "Something went wrong. Please try again."}
              </p>
              <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <Link href="/dashboard/ideas">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
