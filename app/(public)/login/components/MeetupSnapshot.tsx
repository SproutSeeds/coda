"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AUTH_INPUT_STYLE } from "./EmailSignInForm";

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
  const open = useMemo(() => isCheckInOpen(new Date()), []);

  const handleCheckIn = (event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!open) return;
    setDidCheckIn(true);
  };

  return (
    <div className="space-y-4 text-white/80" style={{ maxWidth: "min(100%, clamp(32rem, 62vw, 74rem))" }}>
      {isAuthenticated ? (
        <Button
          type="button"
          onClick={handleCheckIn}
          disabled={!open || didCheckIn}
          className="interactive-btn cursor-pointer w-full border border-white/12 bg-slate-950/80 text-white hover:bg-slate-950"
        >
          {didCheckIn ? "You're checked in" : open ? "Check in here" : "Check-in opens Saturdays 11 AM CT"}
        </Button>
      ) : (
        <form onSubmit={handleCheckIn} className="space-y-3 max-w-4xl">
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
            className={`${AUTH_INPUT_STYLE} text-base`}
            disabled={didCheckIn}
          />
          <Button
            type="submit"
            disabled={!open || didCheckIn}
            className="interactive-btn cursor-pointer w-full border border-white/12 bg-slate-950/80 text-white hover:bg-slate-950 text-base py-2.5"
          >
            {didCheckIn ? "You're checked in" : open ? "Email me the link" : "Check-in opens Saturdays 11 AM CT"}
          </Button>
        </form>
      )}
      <Link
        href="https://www.meetup.com/building-ai-with-ai/"
        target="_blank"
        rel="noreferrer"
        className="interactive-btn swirl-button inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-base font-semibold text-slate-950"
      >
        Join the Coda meetup
      </Link>
    </div>
  );
}
