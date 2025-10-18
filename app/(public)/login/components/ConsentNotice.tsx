"use client";

import Link from "next/link";
import { useId } from "react";

export function ConsentNotice({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const consentCheckboxId = useId();
  return (
    <label className="flex items-start gap-2 text-xs text-white/80" htmlFor={consentCheckboxId}>
      <input
        type="checkbox"
        id={consentCheckboxId}
        name="legal-consent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-[3px] h-4 w-4 cursor-pointer rounded border border-white/50 bg-transparent text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
        required
      />
      <span>
        By continuing, you agree to the {" "}
        <Link href="/legal/terms-of-service" className="underline-offset-2 hover:underline">
          Terms of Service
        </Link>
        {" "}and {" "}
        <Link href="/legal/privacy-policy" className="underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
