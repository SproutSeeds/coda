export const monetizationConfig = {
    pricing: {
        monthlyUsd: 25,
        annualUsd: 240,
    },
    models: {
        default: "google/gemini-2.5-flash-lite",
        multimodal: "google/gemini-2.0-flash",
    },
    mana: {
        usdToMana: 20000,                // 1 USD = 20,000 Mana
        corePerMonthUsd: 10,             // included API budget
        corePerMonthMana: 200000,        // 10 * 20,000
        boostersCountForRewards: false,  // boosters never influence referrals/prestige
    },
    referral: {
        starterGrantMana: 10000,         // to recruit, expires in 30 days
        starterGrantExpiryDays: 30,
        milestones: [
            { key: "verify_and_trial", rewardMana: 5000 },
            { key: "three_quests", rewardMana: 5000 },
            { key: "level_5_or_subscribe", rewardMana: 10000 },
        ],
        perRecruitCapMana: 20000,        // max you can earn per recruit
        perMonthInviterCapMana: 50000,   // max you can earn per month from all recruits
        activationGate: {
            requireLevel5OrSubscription: true,
            requireQuests: 3,
            requireTrialComplete: true,
            requireEmailVerify: true,
        },
        antiAbuse: {
            oneClaimPerPerson: true,
            deviceFingerprinting: true,
            cooldownDaysBetweenRecruits: 0, // set >0 if needed
        },
    },
    gifting: {
        enabled: true,
        giftDurationDays: 30,
        maxGiftsPerMonth: 3,
        allowQueueIfPremium: true,       // queue month if target already premium
        acceptWindowDays: 7,             // refund/credit if not accepted
        casterIncentive: {               // optional, keep modest
            enabled: true,
            trigger: "recipient_uses_3_spells",
            rewardMana: 5000,
        },
    },
    entombing: {
        enabled: false,                  // paused for now
    },
    limits: {
        globalSpendMonitor: true,        // adjust future usdToMana if costs creep
    },
};
