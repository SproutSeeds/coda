"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, Users, Gift, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestBackground } from "../path/components/QuestBackground";
import { BillingCard } from "./components/BillingCard";
import { RankFlipCard } from "./components/RankFlipCard";
import { RefundSection } from "./refund-section";
import { ReferralLink } from "./referral-link";
import {
  sendGiftAction,
  claimGiftAction
} from "./actions";

// Define types for the props
interface Referral {
  id: string;
  inviteeId: string;
  status: string;
}

interface GiftItem {
  id: string;
  senderId: string;
  recipientId: string;
  status: string;
}

interface RefundCharge {
  id: string;
  chargeId: string;
  invoiceId: string | null;
  amountCents: number;
  description: string;
  createdAt: Date;
  isWithinWindow: boolean;
  hasPendingRequest: boolean;
}

interface RefundRequest {
  id: string;
  status: "pending" | "approved" | "denied";
  amountCents: number;
  reason: string;
  createdAt: Date;
  processedAt: Date | null;
  adminNotes: string | null;
}

interface BillingClientProps {
  user: { id: string; email?: string | null };
  wallet: { manaBalance: number; boosterBalance: number };
  subscription: {
    isSorcerer: boolean;
    status: string | null;
    planVariant: "monthly" | "annual" | null;
    planLabel: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    renewalDate: Date | null;
    scheduledCancellation: Date | null;
    scheduledAnnualStart: Date | null;
    scheduledAnnualEnd: Date | null;
  };
  referrals: Referral[];
  gifts: {
    sent: GiftItem[];
    received: GiftItem[];
  };
  refunds: {
    charges: RefundCharge[];
    requests: RefundRequest[];
  };
  monetizationConfig: {
    referral: {
      milestones: Array<{ rewardMana: number }>;
    };
  };
}

export function BillingClient({
  user,
  wallet,
  subscription,
  referrals,
  gifts,
  refunds,
  monetizationConfig
}: BillingClientProps) {
  const { isSorcerer } = subscription;

  return (
    <div className="min-h-screen text-white relative selection:bg-purple-500/30 pb-24">
      <QuestBackground />

      {/* Header */}
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 font-mono text-sm tracking-widest text-purple-300/60">
            &gt; ARCANE_LEDGER<span className="animate-pulse">_</span>
          </div>
          <h1 className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            The Sorcerer&apos;s Pact
          </h1>
          <p className="mt-4 text-lg text-white/40">
            Manage your connection to the Void, track your Mana, and grow the guild.
          </p>
        </motion.div>

        {/* Flattened Grid Layout */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">

          {/* 1. Rank Card with Flip Animation */}
          <div className="md:col-span-2 xl:col-span-2">
            <RankFlipCard
              isSorcerer={isSorcerer}
              subscription={{
                planLabel: subscription.planLabel,
                renewalDate: subscription.renewalDate,
                scheduledCancellation: subscription.scheduledCancellation,
                scheduledAnnualStart: subscription.scheduledAnnualStart,
              }}
            />
          </div>

          {/* 2. Summon a Friend */}
          <div className="md:col-span-1 xl:col-span-1">
            <BillingCard delay={0.1} className="h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-pink-500/20">
                  <Users className="w-4 h-4 text-pink-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Summon a Friend</h3>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Invite others to the guild. Earn {monetizationConfig.referral.milestones[2].rewardMana.toLocaleString()} Mana when they reach Level 5.
              </p>
              
              <div className="mb-6">
                <ReferralLink userId={user.id} totalSummons={referrals.length} />
              </div>

              {referrals.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">Recent Summons</h4>
                  {referrals.map((ref: Referral) => (
                    <div key={ref.id} className="flex items-center justify-between text-sm p-2 rounded bg-white/5">
                      <span className="text-white/60 truncate w-24">{ref.inviteeId.slice(0,8)}...</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded", ref.status === 'completed' ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40")}>
                        {ref.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </BillingCard>
          </div>

          {/* 3. Mana Core */}
          <div className="md:col-span-1 xl:col-span-1">
            <BillingCard delay={0.2} className="h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Core Mana</h3>
              </div>
              <div className="text-3xl font-light text-white mb-1">
                {wallet.manaBalance.toLocaleString()}
              </div>
              <p className="text-xs text-white/40">Refreshes monthly</p>
            </BillingCard>
          </div>

          {/* 4. Mana Booster */}
          <div className="md:col-span-1 xl:col-span-1">
            <BillingCard delay={0.3} variant="sorcerer" className="h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-amber-100">Booster Mana</h3>
              </div>
              <div className="text-3xl font-light text-amber-100 mb-1">
                {wallet.boosterBalance.toLocaleString()}
              </div>
              <p className="text-xs text-amber-200/40">Permanent reserve</p>
            </BillingCard>
          </div>

          {/* 5. Gifts Received */}
          <div className="md:col-span-1 xl:col-span-1">
            <BillingCard delay={0.4} className="h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Gift className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Gift of Knowledge</h3>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Grant a fellow seeker 30 days of full Grimoire access.
              </p>

              <form action={sendGiftAction} className="flex gap-2 mb-6">
                <input 
                  type="email" 
                  name="email" 
                  placeholder="Email" 
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                  Send
                </button>
              </form>

              {gifts.received.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">Gifts Received</h4>
                  {gifts.received.map((gift: GiftItem) => (
                    <div key={gift.id} className="flex items-center justify-between text-sm p-2 rounded bg-white/5">
                      <span className="text-white/60">From: {gift.senderId.slice(0,8)}...</span>
                      {gift.status === 'pending' ? (
                        <button onClick={() => claimGiftAction(gift.id)} className="text-emerald-400 hover:underline text-xs">
                          Claim
                        </button>
                      ) : (
                        <span className="text-white/30 text-xs capitalize">{gift.status}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </BillingCard>
          </div>

          {/* 6. Refund History (Wide) - Only if exists */}
          {(refunds.charges.length > 0 || refunds.requests.length > 0) && (
            <div className="md:col-span-2 xl:col-span-3">
              <BillingCard delay={0.5} className="h-full">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldAlert className="w-5 h-5 text-white/60" />
                  <h3 className="text-lg font-semibold text-white">Refund Requests</h3>
                </div>
                <RefundSection 
                  initialCharges={refunds.charges}
                  initialRequests={refunds.requests}
                />
              </BillingCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
