"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AUTH_INPUT_STYLE } from "./EmailSignInForm";
import { checkInToMeetupAction } from "../actions";

function isCheckInOpen(now: Date) {
  const centralString = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  const centralNow = new Date(centralString);
  const isSaturday = centralNow.getDay() === 6;
  const hour = centralNow.getHours();
  return isSaturday && hour >= 11 && hour < 13;
}

export function MeetupSnapshot({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [email, setEmail] = useState("");
  const [didCheckIn, setDidCheckIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calculate check-in open state on client only to prevent hydration mismatch
  useEffect(() => {
    setOpen(isCheckInOpen(new Date()));
  }, []);

  const handleCheckIn = (event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!open || isPending) return;

    startTransition(async () => {
      try {
        const result = await checkInToMeetupAction(isAuthenticated ? undefined : email);

        if (result.success) {
          setDidCheckIn(true);
          toast.success(result.message ?? "Successfully checked in!");
        } else {
          toast.error(result.error ?? "Unable to check in");
        }
      } catch (error) {
        console.error("[MeetupSnapshot] Check-in failed:", error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-3 text-white/80">
      {isAuthenticated ? (
        <Button
          type="button"
          onClick={handleCheckIn}
          disabled={!open || didCheckIn || isPending}
          className="interactive-btn cursor-pointer w-full border border-white/12 bg-slate-950/80 text-white hover:bg-slate-950"
        >
          {isPending ? "Checking in…" : didCheckIn ? "You're checked in" : open ? "Check in here" : "Check-in opens Saturdays 11 AM CT"}
        </Button>
      ) : (
        <form onSubmit={handleCheckIn} className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/55" htmlFor="meetup-email">
            Email address
          </label>
          <Input
            id="meetup-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={AUTH_INPUT_STYLE}
            disabled={didCheckIn || isPending}
          />
          <Button
            type="submit"
            disabled={!open || didCheckIn || isPending}
            className="interactive-btn cursor-pointer w-full border border-white/12 bg-slate-950/80 text-white hover:bg-slate-950"
          >
            {isPending ? "Checking in…" : didCheckIn ? "You're checked in" : open ? "Email me the link" : "Check-in opens Saturdays 11 AM CT"}
          </Button>
        </form>
      )}
      <Link
        href="https://www.meetup.com/building-ai-with-ai/"
        target="_blank"
        rel="noreferrer"
        className="interactive-btn swirl-button inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-slate-950"
      >
        Join the Coda meetup
      </Link>
    </div>
  );
}
