Exit code: 0
Wall time: 1.1 seconds
Output:
import { createHash, randomBytes } from "node:crypto";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function createResetToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");

  if (!apiKey || !from || !appUrl) {
    throw new Error("Missing RESEND_API_KEY, EMAIL_FROM or FRONTEND_URL");
  }

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "RÃ©initialisation de votre mot de passe QARA",
      text: `Une rÃ©initialisation de votre mot de passe QARA a Ã©tÃ© demandÃ©e.\n\nChoisissez un nouveau mot de passe : ${resetUrl}\n\nCe lien expire dans 30 minutes et ne peut Ãªtre utilisÃ© qu'une seule fois.\n\nSi vous n'Ãªtes pas Ã  l'origine de cette demande, ignorez cet email.`,
      html: `<p>Une rÃ©initialisation de votre mot de passe QARA a Ã©tÃ© demandÃ©e.</p>
<p><a href="${safeUrl}">Choisir un nouveau mot de passe</a></p>
<p>Ce lien expire dans 30 minutes et ne peut Ãªtre utilisÃ© qu'une seule fois.</p>
<p>Si vous n'Ãªtes pas Ã  l'origine de cette demande, ignorez cet email.</p>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend rejected password reset email (${response.status}): ${details}`);
  }
}

