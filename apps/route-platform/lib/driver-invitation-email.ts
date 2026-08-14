import { Resend } from "resend";

export async function sendDriverInvitationEmail(input: { recipient: string; name: string; actionLink: string }) {
  const apiKey = process.env.RESEND_INVITATIONS_API_KEY || process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Der E-Mail-Versand ist nicht konfiguriert.");

  const resend = new Resend(apiKey);
  const safeName = input.name.replace(/[<>]/g, "");
  const { data, error } = await resend.emails.send({
    from,
    to: [input.recipient],
    subject: "Einladung zu AutomateX Route",
    text: `Hallo ${input.name},\n\ndu wurdest als Fahrer zu AutomateX Route eingeladen. Lege über diesen persönlichen Link dein Passwort fest:\n${input.actionLink}\n\nDer Link ist nur einmal gültig. Falls du diese Einladung nicht erwartest, ignoriere diese E-Mail.`,
    html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#16222d"><h1 style="font-size:24px">Willkommen bei AutomateX Route</h1><p>Hallo ${safeName},</p><p>du wurdest als Fahrer eingeladen. Über den folgenden Button legst du dein persönliches Passwort fest.</p><p style="margin:28px 0"><a href="${input.actionLink}" style="display:inline-block;background:#18b982;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Passwort festlegen</a></p><p style="font-size:13px;color:#61717d">Der Link ist nur einmal gültig. Falls du diese Einladung nicht erwartest, ignoriere diese E-Mail.</p></main>`,
  });
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Der E-Mail-Anbieter hat keine Versandbestätigung zurückgegeben.");
  return data.id;
}
