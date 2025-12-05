import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function resolveTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const url = process.env.EMAIL_SERVER;
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;

  if (url === "stream") {
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
    return cachedTransporter;
  }

  if (url && url.includes("smtp://")) {
    cachedTransporter = nodemailer.createTransport(url);
    return cachedTransporter;
  }

  if (!url) {
    console.warn("[Email] EMAIL_SERVER not configured - billing emails disabled");
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: url,
    port: port ?? 587,
    secure: (port ?? 587) === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });

  return cachedTransporter;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.warn("[Email] EMAIL_FROM not set - skipping email");
    return;
  }

  const transporter = resolveTransporter();
  if (!transporter) {
    console.log(`[Email] Would send: "${opts.subject}" to ${opts.to}`);
    return;
  }

  try {
    await transporter.sendMail({
      to: opts.to,
      from,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    console.log(`[Email] Sent: "${opts.subject}" to ${opts.to}`);
  } catch (error) {
    console.error(`[Email] Failed to send "${opts.subject}" to ${opts.to}`, error);
    // Don't throw - email failures shouldn't break the main flow
  }
}

// --- Refund Emails ---

export async function sendRefundConfirmationEmail(opts: {
  email: string;
  refundAmountCents: number;
  originalAmountCents: number;
  usageCostCents?: number;
  refundType: "subscription" | "booster";
}) {
  const refundAmount = (opts.refundAmountCents / 100).toFixed(2);
  const originalAmount = (opts.originalAmountCents / 100).toFixed(2);
  const usageDeduction = opts.usageCostCents
    ? `\n\nUsage deduction: $${(opts.usageCostCents / 100).toFixed(2)}`
    : "";

  const subject = `Your Coda refund has been processed - $${refundAmount}`;
  const typeLabel = opts.refundType === "subscription" ? "subscription" : "booster purchase";

  await sendEmail({
    to: opts.email,
    subject,
    text: `Your refund for your Coda ${typeLabel} has been processed.

Original charge: $${originalAmount}
Refunded amount: $${refundAmount}${usageDeduction}

The refund will appear on your card within 5-10 business days.

If you have any questions, please reply to this email.

— The Coda Team`,
    html: `
      <h2>Your refund has been processed</h2>
      <p>Your refund for your Coda ${typeLabel} has been processed.</p>
      <table style="margin: 20px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">Original charge:</td>
          <td style="padding: 8px 0; font-weight: bold;">$${originalAmount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">Refunded amount:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #22c55e;">$${refundAmount}</td>
        </tr>
        ${opts.usageCostCents ? `
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">Usage deduction:</td>
          <td style="padding: 8px 0;">$${(opts.usageCostCents / 100).toFixed(2)}</td>
        </tr>
        ` : ""}
      </table>
      <p style="color: #666;">The refund will appear on your card within 5-10 business days.</p>
      <p>If you have any questions, please reply to this email.</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

// --- Gift Emails ---

export async function sendGiftReceivedEmail(opts: {
  recipientEmail: string;
  senderName: string;
  expiresAt: Date;
  claimUrl: string;
}) {
  const expiresFormatted = opts.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  await sendEmail({
    to: opts.recipientEmail,
    subject: `${opts.senderName} gifted you a month of Coda Premium!`,
    text: `Great news! ${opts.senderName} has gifted you a month of Coda Premium.

Claim your gift before ${expiresFormatted}: ${opts.claimUrl}

— The Coda Team`,
    html: `
      <h2>You've received a gift!</h2>
      <p><strong>${opts.senderName}</strong> has gifted you a month of <strong>Coda Premium</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${opts.claimUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Claim Your Gift
        </a>
      </p>
      <p style="color: #666;">This gift expires on ${expiresFormatted}.</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

export async function sendGiftSentConfirmationEmail(opts: {
  senderEmail: string;
  recipientEmail: string;
}) {
  await sendEmail({
    to: opts.senderEmail,
    subject: `Your Coda gift has been sent to ${opts.recipientEmail}`,
    text: `Your gift has been sent!

${opts.recipientEmail} will receive an email with instructions to claim their month of Coda Premium. They have 7 days to accept.

Thank you for sharing Coda!

— The Coda Team`,
    html: `
      <h2>Your gift has been sent!</h2>
      <p><strong>${opts.recipientEmail}</strong> will receive an email with instructions to claim their month of Coda Premium.</p>
      <p style="color: #666;">They have 7 days to accept the gift.</p>
      <p style="margin-top: 24px;">Thank you for sharing Coda!</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

export async function sendGiftAcceptedEmail(opts: {
  senderEmail: string;
  recipientName: string;
}) {
  await sendEmail({
    to: opts.senderEmail,
    subject: `${opts.recipientName} accepted your Coda gift!`,
    text: `Good news! ${opts.recipientName} has accepted your gift of Coda Premium.

Thank you for being part of the Coda community!

— The Coda Team`,
    html: `
      <h2>Your gift was accepted!</h2>
      <p><strong>${opts.recipientName}</strong> has accepted your gift of Coda Premium.</p>
      <p style="margin-top: 24px;">Thank you for being part of the Coda community!</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

// --- Subscription Emails ---

export async function sendSubscriptionCancelledEmail(opts: {
  email: string;
  expiresAt: Date;
}) {
  const expiresFormatted = opts.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  await sendEmail({
    to: opts.email,
    subject: "Your Coda subscription has been cancelled",
    text: `Your Coda subscription has been cancelled.

You'll continue to have access until ${expiresFormatted}.

We're sorry to see you go. If you change your mind, you can resubscribe anytime from your billing page.

— The Coda Team`,
    html: `
      <h2>Subscription cancelled</h2>
      <p>Your Coda subscription has been cancelled.</p>
      <p>You'll continue to have access until <strong>${expiresFormatted}</strong>.</p>
      <p style="margin-top: 24px; color: #666;">We're sorry to see you go. If you change your mind, you can resubscribe anytime from your billing page.</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

export async function sendAnnualUpgradeScheduledEmail(opts: {
  email: string;
  startDate: Date;
  savingsAmount: number;
}) {
  const startFormatted = opts.startDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  await sendEmail({
    to: opts.email,
    subject: "Your annual plan upgrade is scheduled!",
    text: `Your upgrade to Coda Annual has been scheduled.

Your annual plan will begin on ${startFormatted}. You'll save $${opts.savingsAmount} compared to monthly billing!

You can cancel this scheduled upgrade anytime before it takes effect.

— The Coda Team`,
    html: `
      <h2>Annual upgrade scheduled!</h2>
      <p>Your upgrade to <strong>Coda Annual</strong> has been scheduled.</p>
      <p>Your annual plan will begin on <strong>${startFormatted}</strong>.</p>
      <p style="margin: 16px 0; padding: 12px 16px; background: #f0fdf4; border-radius: 8px; color: #166534;">
        You'll save <strong>$${opts.savingsAmount}</strong> compared to monthly billing!
      </p>
      <p style="color: #666;">You can cancel this scheduled upgrade anytime before it takes effect.</p>
      <p style="margin-top: 32px; color: #666;">— The Coda Team</p>
    `,
  });
}

// --- Admin Notifications ---

export async function sendAdminRefundRequestEmail(opts: {
  userEmail: string;
  amountCents: number;
  reason: string;
  chargeId: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[Email] ADMIN_EMAIL not set - skipping admin notification");
    return;
  }

  await sendEmail({
    to: adminEmail,
    subject: `[Coda Admin] Refund Request - $${(opts.amountCents / 100).toFixed(2)}`,
    text: `New refund request from ${opts.userEmail}

Amount: $${(opts.amountCents / 100).toFixed(2)}
Charge ID: ${opts.chargeId}

Reason: ${opts.reason}

Review in admin dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/admin/refunds`,
    html: `
      <h2>New Refund Request</h2>
      <table style="margin: 20px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">User:</td>
          <td style="padding: 8px 0;">${opts.userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">Amount:</td>
          <td style="padding: 8px 0; font-weight: bold;">$${(opts.amountCents / 100).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 16px 8px 0; color: #666;">Charge ID:</td>
          <td style="padding: 8px 0; font-family: monospace;">${opts.chargeId}</td>
        </tr>
      </table>
      <p><strong>Reason:</strong></p>
      <p style="padding: 12px; background: #f3f4f6; border-radius: 4px;">${opts.reason}</p>
      <p style="margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/admin/refunds" style="display: inline-block; padding: 12px 24px; background: #111827; color: #ffffff; border-radius: 8px; text-decoration: none;">
          Review in Admin Dashboard
        </a>
      </p>
    `,
  });
}
