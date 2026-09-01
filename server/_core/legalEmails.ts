function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Missing RESEND_API_KEY or EMAIL_FROM");

  const { to, ...message } = input;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], ...message }),
  });
  if (!response.ok) throw new Error(`Resend rejected legal email (${response.status}): ${await response.text()}`);
}

export async function sendWelcomeEmail(email: string, displayName?: string | null) {
  const appUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, "");
  const contact = process.env.EMAIL_FROM?.trim();
  if (!appUrl || !contact) throw new Error("Missing FRONTEND_URL or EMAIL_FROM");
  const privacyUrl = `${appUrl}/politique-confidentialite`;
  const greeting = displayName?.trim() || email;

  await sendEmail({
    to: email,
    subject: "Bienvenue sur QARA — Votre espace de conformité DM",
    text: `Bonjour ${greeting},\n\nVotre compte QARA est créé. Vous pouvez maintenant :\n- Créer votre premier audit de conformité\n- Accéder aux 7 référentiels DM (MDR, IVDR, FDA QMSR...)\n- Générer des rapports de conformité structurés\n\nLe backend et la base de données sont hébergés en Europe et vos données sont traitées conformément au RGPD. Pour en savoir plus : ${privacyUrl}\n\nVos droits : accès, rectification, effacement, portabilité.\nContact : ${contact}\n\nL'équipe QARA`,
    html: `<p>Bonjour ${escapeHtml(greeting)},</p><p>Votre compte QARA est créé. Vous pouvez maintenant :</p><ul><li>Créer votre premier audit de conformité</li><li>Accéder aux 7 référentiels DM (MDR, IVDR, FDA QMSR...)</li><li>Générer des rapports de conformité structurés</li></ul><p>Le backend et la base de données sont hébergés en Europe et vos données sont traitées conformément au RGPD. <a href="${escapeHtml(privacyUrl)}">Consulter la politique de confidentialité</a>.</p><p>Vos droits : accès, rectification, effacement, portabilité.<br>Contact : ${escapeHtml(contact)}</p><p>L'équipe QARA</p>`,
  });
}

export function buildCguUpdateEmail(input: { appUrl: string; effectiveDate: string; changes: string }) {
  const cguUrl = `${input.appUrl.replace(/\/$/, "")}/cgu`;
  return {
    subject: "Mise à jour des Conditions d'Utilisation de QARA",
    text: `Bonjour,\n\nNous avons mis à jour nos Conditions Générales d'Utilisation.\nLes changements principaux : ${input.changes}\n\nLes nouvelles CGU sont disponibles ici : ${cguUrl}\n\nElles entrent en vigueur le ${input.effectiveDate}. La poursuite de l'utilisation de QARA vaut acceptation, dans les limites prévues par la loi.\n\nL'équipe QARA`,
    html: `<p>Bonjour,</p><p>Nous avons mis à jour nos Conditions Générales d'Utilisation.</p><p>Les changements principaux : ${escapeHtml(input.changes)}</p><p><a href="${escapeHtml(cguUrl)}">Consulter les nouvelles CGU</a></p><p>Elles entrent en vigueur le ${escapeHtml(input.effectiveDate)}. La poursuite de l'utilisation de QARA vaut acceptation, dans les limites prévues par la loi.</p><p>L'équipe QARA</p>`,
  };
}
