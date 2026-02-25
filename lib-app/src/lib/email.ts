import "server-only";

import nodemailer from "nodemailer";

type SendLoginCodeEmailArgs = {
  to: string;
  userName: string;
  code: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  return transporter;
}

export async function sendLoginCodeEmail({
  to,
  userName,
  code,
}: SendLoginCodeEmailArgs): Promise<{ delivered: boolean; reason: string }> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const mailer = getTransporter();

  if (!mailer || !from) {
    console.log(
      `[DEV LOGIN CODE] ${to} (${userName}) => ${code}. Configure SMTP_* env vars to send real email.`,
    );
    return {
      delivered: false,
      reason:
        "SMTP is not configured. Code was written to server logs for local development.",
    };
  }

  try {
    await mailer.sendMail({
      from,
      to,
      subject: "Your Media Catalog login code",
      text: `Hello ${userName},\n\nYour login code is ${code}. It expires in 10 minutes.\n`,
      html: `
        <p>Hello ${userName},</p>
        <p>Your Media Catalog login code is:</p>
        <h2>${code}</h2>
        <p>This code expires in 10 minutes.</p>
      `,
    });

    return { delivered: true, reason: "Email sent successfully." };
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "Unknown SMTP error";

    console.error(`[SMTP SEND FAILED] ${reason}`);
    return {
      delivered: false,
      reason:
        "Login email could not be sent. SMTP settings were rejected by the provider.",
    };
  }
}
