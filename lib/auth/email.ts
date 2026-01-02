import nodemailer, { type Transporter } from "nodemailer";

type MailRecord = {
  email: string;
  url: string;
  raw: string;
};

const globalInbox = (globalThis as unknown as { __codaTestInbox?: MailRecord[] }).__codaTestInbox;
const testInbox: MailRecord[] = globalInbox ?? [];
(globalThis as unknown as { __codaTestInbox?: MailRecord[] }).__codaTestInbox = testInbox;

let cachedTransporter: Transporter | null = null;
let cachedPasswordTransporter: Transporter | null = null;

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
    throw new Error("EMAIL_SERVER is not configured. Provide SMTP host or connection string.");
  }

  cachedTransporter = nodemailer.createTransport({
    host: url,
    port: port ?? 587,
    secure: (port ?? 587) === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });

  return cachedTransporter;
}

function resolvePasswordTransporter() {
  if (cachedPasswordTransporter) return cachedPasswordTransporter;

  const url = process.env.PASSWORD_EMAIL_SERVER;
  const port = process.env.PASSWORD_EMAIL_PORT ? Number(process.env.PASSWORD_EMAIL_PORT) : undefined;
  const user = process.env.PASSWORD_EMAIL_USER;
  const password = process.env.PASSWORD_EMAIL_PASSWORD;

  if (url === "stream") {
    cachedPasswordTransporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
    return cachedPasswordTransporter;
  }

  if (url && url.includes("smtp://")) {
    cachedPasswordTransporter = nodemailer.createTransport(url);
    return cachedPasswordTransporter;
  }

  if (!url) {
    throw new Error("PASSWORD_EMAIL_SERVER is not configured. Provide SMTP host or connection string.");
  }

  cachedPasswordTransporter = nodemailer.createTransport({
    host: url,
    port: port ?? 587,
    secure: (port ?? 587) === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });

  return cachedPasswordTransporter;
}

export async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not set.");
  }

  const transporter = resolveTransporter();
  let result;
  try {
    result = await transporter.sendMail({
      to: email,
      from,
      subject: "Your Coda sign-in link",
      text: `Sign in to Coda using this link: ${url}\n\nThe link expires in 10 minutes. If you did not request it, you can ignore this message.`,
      html: `
        <p>Sign in to <strong>Coda</strong> using the button below. The link expires in 10 minutes.</p>
        <p><a href="${url}" style="display:inline-block;padding:12px 16px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;">Sign in to Coda</a></p>
        <p>If you did not request this email, you can safely ignore it.</p>
        <p><a href="${url}">${url}</a></p>
      `,
    });
  } catch (error) {
    console.error("Magic link email send failed", error);
    throw new Error("EmailSignin");
  }

  const rejected = Array.isArray(result.rejected) ? result.rejected : [];
  const pending = Array.isArray(result.pending) ? result.pending : [];

  if (rejected.length > 0 || pending.length > 0) {
    console.error("Magic link email rejected", { email, rejected, pending });
    throw new Error("EmailSignin");
  }

  const maybeMessage = (result as unknown as { message?: Buffer }).message;
  const raw = maybeMessage ? maybeMessage.toString("utf8") : "";
  testInbox.push({ email: email.toLowerCase(), url, raw });
}

export async function sendPasswordVerificationEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const from = process.env.PASSWORD_EMAIL_FROM;
  if (!from) {
    throw new Error("PASSWORD_EMAIL_FROM is not set.");
  }

  const transporter = resolvePasswordTransporter();
  let result;
  try {
    result = await transporter.sendMail({
      to: email,
      from,
      subject: "Confirm your Coda password",
      text: `Finish setting up your password to access Coda: ${url}\n\nThis link expires in 24 hours. If you didn't request it, you can ignore this message.`,
      html: `
        <p><strong>One quick step left.</strong> Confirm your email to finish creating your password for Coda.</p>
        <p><a href="${url}" style="display:inline-block;padding:12px 16px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;">Confirm email &amp; continue</a></p>
        <p>This link expires in 24 hours. If you didn't request it, you can safely ignore this email.</p>
        <p><a href="${url}">${url}</a></p>
      `,
    });
  } catch (error) {
    console.error("Password verification email send failed", error);
    throw new Error("EmailVerification");
  }

  const rejected = Array.isArray(result.rejected) ? result.rejected : [];
  const pending = Array.isArray(result.pending) ? result.pending : [];

  if (rejected.length > 0 || pending.length > 0) {
    console.error("Password verification email rejected", { email, rejected, pending });
    throw new Error("EmailVerification");
  }

  if (process.env.PASSWORD_EMAIL_SERVER === "stream") {
    const maybeMessage = (result as unknown as { message?: Buffer }).message;
    const raw = maybeMessage ? maybeMessage.toString("utf8") : "";
    testInbox.push({ email: email.toLowerCase(), url, raw });
  }
}

export async function sendMfaCodeEmail({
  email,
  code,
}: {
  email: string;
  code: string;
}) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not set.");
  }

  const transporter = resolveTransporter();
  let result;
  try {
    result = await transporter.sendMail({
      to: email,
      from,
      subject: "Your Coda verification code",
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this code, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px;">Verify your identity</h1>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Enter this code to complete your sign-in to Coda:
          </p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
            This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("MFA code email send failed", error);
    throw new Error("EmailMfaCode");
  }

  const rejected = Array.isArray(result.rejected) ? result.rejected : [];
  const pending = Array.isArray(result.pending) ? result.pending : [];

  if (rejected.length > 0 || pending.length > 0) {
    console.error("MFA code email rejected", { email, rejected, pending });
    throw new Error("EmailMfaCode");
  }

  const maybeMessage = (result as unknown as { message?: Buffer }).message;
  const raw = maybeMessage ? maybeMessage.toString("utf8") : "";
  testInbox.push({ email: email.toLowerCase(), url: code, raw });
}

export function getTestInbox() {
  return testInbox;
}

export function clearTestInbox() {
  testInbox.length = 0;
}
