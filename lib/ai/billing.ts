import { requireAiAccess } from "@/lib/plans/access";
import { CREDIT_PRICING } from "@/lib/plans/constants";
import { recordCreditUsage, refundCreditUsage } from "@/lib/monetization/wallet";

type BillableOp = keyof typeof CREDIT_PRICING;

type UnitOptions = {
  minutes?: number;
};

type BillableHandler<T> = () => Promise<T>;

export async function runBillableAiOp<T>(options: {
  userId: string;
  op: BillableOp;
  units?: UnitOptions;
  refType?: string;
  refId?: string;
  handler: BillableHandler<T>;
}): Promise<T> {
  await requireAiAccess(options.userId);
  const cost = calculateCredits(options.op, options.units);
  if (cost <= 0) {
    throw new Error(`Invalid credit cost for operation ${options.op}`);
  }

  const usageResult = await recordCreditUsage(options.userId, cost, options.op, { refType: options.refType, refId: options.refId });

  try {
    return await options.handler();
  } catch (error) {
    await refundCreditUsage(
      options.userId,
      usageResult.bucketDelta,
      {
        refType: options.refType,
        refId: options.refId ?? `refund:${options.op}`,
      },
    );
    throw error;
  }
}

function calculateCredits(op: BillableOp, units?: UnitOptions) {
  const base = CREDIT_PRICING[op];
  if (op === "AUDIO_TRANSCRIBE_PER_MIN" || op === "VIDEO_TRANSCRIBE_PER_MIN") {
    const minutes = Math.max(1, Math.ceil(Math.max(0, units?.minutes ?? 0)));
    return base * minutes;
  }
  return base;
}
