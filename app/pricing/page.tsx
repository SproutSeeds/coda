import Link from "next/link";
import { monetizationConfig } from "@/lib/config/monetization";
import { requireUser } from "@/lib/auth/session";
import { subscribeAction } from "@/app/dashboard/billing/actions";

export default async function PricingPage() {
    // Check if user is logged in to show appropriate CTA
    let isLoggedIn = false;
    try {
        await requireUser();
        isLoggedIn = true;
    } catch {
        isLoggedIn = false;
    }

    const { pricing, mana } = monetizationConfig;

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-24 sm:px-6">
            <section className="text-center space-y-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">The Sorcerer&apos;s Pact</p>
                <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">One path to mastery.</h1>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                    No confusing tiers. One simple subscription gives you the full power of the Grimoire and a monthly allowance of Mana.
                </p>
            </section>

            <div className="mx-auto w-full max-w-md">
                <div className="relative rounded-3xl border border-border/60 bg-card p-8 shadow-xl ring-1 ring-primary/10">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-semibold text-white shadow-sm">
                        Most Popular
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-foreground">Sorcerer Status</h3>
                        <div className="mt-4 flex items-baseline justify-center gap-1">
                            <span className="text-5xl font-bold tracking-tight text-foreground">${pricing.monthlyUsd}</span>
                            <span className="text-sm font-semibold text-muted-foreground">/month</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">or ${pricing.annualUsd}/year (save 20%)</p>
                    </div>

                    <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                            <span>
                                <strong className="text-foreground">{mana.corePerMonthMana.toLocaleString()} Core Mana</strong> monthly allowance (expires each month).
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                            <span>
                                Full access to the <strong>Grimoire of Remembrance</strong> and all spellbooks.
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                            <span>
                                Priority access to the <strong>Aether</strong> (Gemini 2.0 Flash) for multimodal casting.
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                            <span>
                                <strong>Summon a Friend</strong> rewards: Earn up to 50k Mana/month for growing the guild.
                            </span>
                        </li>
                    </ul>

                    <div className="mt-8">
                        {isLoggedIn ? (
                            <form action={subscribeAction}>
                                <button
                                    type="submit"
                                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                                >
                                    Sign the Pact
                                </button>
                            </form>
                        ) : (
                            <Link
                                href="/login?next=/pricing"
                                className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                            >
                                Sign in to Subscribe
                            </Link>
                        )}
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            Cancel anytime. Mana rolls over only if you maintain active status.
                        </p>
                    </div>
                </div>
            </div>

            <section className="mx-auto max-w-3xl text-center space-y-8 border-t border-border/40 pt-12">
                <h2 className="text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
                <div className="grid gap-6 sm:grid-cols-2 text-left">
                    <div>
                        <h3 className="font-semibold text-foreground">What is Core Mana?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Core Mana is your monthly allowance included with the subscription. It resets every month and does not roll over.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">What if I run out?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            You can purchase "Booster Mana" potions at any time. Booster Mana never expires as long as your account is active.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Can I gift a subscription?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Yes! Use the "Gift of Knowledge" feature in your billing dashboard to buy a month for a friend.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Is there a free tier?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            You can start as a "Wanderer" to explore the interface, but casting spells requires Mana, which comes with the Pact.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
