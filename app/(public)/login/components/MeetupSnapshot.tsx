"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const [didCheckIn, setDidCheckIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calculate check-in open state on client only to prevent hydration mismatch
  useEffect(() => {
    setOpen(isCheckInOpen(new Date()));
  }, []);

  const handleCheckIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!open || isPending) return;

    startTransition(async () => {
      try {
        const result = await checkInToMeetupAction();

        if (result.success) {
          setDidCheckIn(true);
          toast.success(result.message ?? "Successfully checked in!");
        } else if (result.error) {
          toast.error(result.error);
        } else {
          toast.error("Unable to check in right now.");
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
        <Button
          type="button"
          onClick={() => {
            toast.info("Sign in to Coda to check in to the meetings.", {
              description: "We’ll bring you right back here once you’re in.",
            });
            router.push("/login?redirect=/check-in&focus=meetup-checkin");
          }}
          disabled={isPending}
          className="interactive-btn cursor-pointer w-full border border-white/12 bg-slate-950/80 text-white hover:bg-slate-950"
        >
          {open ? "Sign in to check in" : "Sign in to be ready when check-in opens"}
        </Button>
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
