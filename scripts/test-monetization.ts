import { grantMonthlyCoreMana, createReferral, checkReferralMilestones, sendGift, claimGift } from "../lib/monetization/actions";
import { getDb } from "../lib/db";
import { users, wallets, progression, referrals, gifts } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const db = getDb();

async function runTest() {
    console.log("Starting Monetization Logic Test...");

    // 1. Create Mock Users
    const inviterId = `test-inviter-${Date.now()}`;
    const inviteeId = `test-invitee-${Date.now()}`;

    await db.insert(users).values([
        { id: inviterId, email: `inviter-${Date.now()}@test.com`, name: "Inviter" },
        { id: inviteeId, email: `invitee-${Date.now()}@test.com`, name: "Invitee" },
    ]);

    // Initialize Wallets & Progression
    await db.insert(wallets).values([
        { userId: inviterId, manaBalance: 0 },
        { userId: inviteeId, manaBalance: 0 },
    ]);
    await db.insert(progression).values([
        { userId: inviterId },
        { userId: inviteeId },
    ]);

    console.log("Users created.");

    // 2. Test Monthly Grant
    console.log("Testing Monthly Grant...");
    await grantMonthlyCoreMana(inviterId);
    const inviterWallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, inviterId) });
    console.log(`Inviter Mana after grant: ${inviterWallet?.manaBalance} (Expected: 200000)`);

    // 3. Test Referral
    console.log("Testing Referral Creation...");
    await createReferral(inviterId, inviteeId);
    const inviteeWallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, inviteeId) });
    console.log(`Invitee Mana after referral: ${inviteeWallet?.manaBalance} (Expected: 10000)`);

    // 4. Test Referral Milestones
    console.log("Testing Referral Milestones...");
    // Simulate Level 5
    await db.update(progression).set({ level: 5 }).where(eq(progression.userId, inviteeId));
    await checkReferralMilestones(inviteeId);

    const inviterWalletAfter = await db.query.wallets.findFirst({ where: eq(wallets.userId, inviterId) });
    // Should get verify (5000) + level 5 (10000) = 15000 + initial 200000 = 215000
    console.log(`Inviter Mana after milestones: ${inviterWalletAfter?.manaBalance} (Expected: ~215000)`);

    // 5. Test Gifting
    console.log("Testing Gifting...");
    await sendGift(inviterId, inviteeId);
    const gift = await db.query.gifts.findFirst({ where: eq(gifts.recipientId, inviteeId) });

    if (gift) {
        await claimGift(inviteeId, gift.id);
        const inviteeProgression = await db.query.progression.findFirst({ where: eq(progression.userId, inviteeId) });
        console.log(`Invitee Channeling Status: ${inviteeProgression?.isChanneling} (Expected: true)`);
    } else {
        console.error("Gift creation failed.");
    }

    console.log("Test Complete.");
    process.exit(0);
}

runTest().catch(console.error);
