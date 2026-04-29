import { Resend } from "resend";

// Initialize Resend with API key
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Check if Resend is configured
if (!resend) {
  console.warn(
    "⚠️  RESEND_API_KEY not set. Email features will be logged to console only.",
  );
  console.warn("   Get your API key at https://resend.com/api-keys");
} else {
  console.log("📧 Email service (Resend) configured");
}

export const sendEmail = async ({ to, subject, html, text }) => {
  // If Resend not configured, log to console instead
  if (!resend) {
    console.log("\n📧 --- EMAIL (Not sent - Resend not configured) ---");
    console.log("   To:", to);
    console.log("   Subject:", subject);
    console.log("   Body preview:", html?.substring(0, 150) + "...");
    console.log("----------------------------------------------------\n");
    return;
  }

  try {
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.FROM_NAME || "Stemy";

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text || html?.replace(/<[^>]*>/g, ""),
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    console.log(`📧 Email sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    console.error("Failed to send email:", err.message);
    throw err;
  }
};
