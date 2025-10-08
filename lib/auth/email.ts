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

export function getTestInbox() {
  return testInbox;
}

export function clearTestInbox() {
  testInbox.length = 0;
}
