import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";

const TRAIL_END_REMINDER_DAYS = 3;

const reminderEmail = (firstName, trialEndsAt) => `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0a0a0f;color:#e5e7eb;border-radius:12px;">
  <h1 style="color:#f59e0b;margin-bottom:16px;">Your Stemy trial is ending soon</h1>
  <p>Hey ${firstName || 'artist'},</p>
  <p>Your 7-day free trial will end on <strong>${trialEndsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>.</p>
  <p style="margin-top:16px;">Don't lose access to:</p>
  <ul>
    <li>Unlimited AI-powered mastering</li>
    <li>Genre-specific mastering chains</li>
    <li>High-quality 24-bit WAV downloads</li>
  </ul>
  <p style="margin-top:20px;">Upgrade now to keep mastering without interruption.</p>
  <div style="margin-top:24px;">
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}" style="display:inline-block;padding:12px 24px;background:#00e5a0;color:#0a0a0f;text-decoration:none;border-radius:8px;font-weight:600;">Upgrade to Pro</a>
  </div>
  <p style="margin-top:24px;font-size:14px;opacity:0.7;">— Team Stemy</p>
</div>
`;

export const startTrialReminderCron = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + TRAIL_END_REMINDER_DAYS);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 1);

      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: "TRIALING",
          trialEndsAt: {
            gte: threeDaysAgo,
            lte: threeDaysFromNow,
          },
        },
        include: {
          user: true,
        },
      });

      if (subscriptions.length === 0) return;

      console.log(`🔔 Sending trial ending reminders to ${subscriptions.length} user(s)`);

      for (const sub of subscriptions) {
        try {
          await sendEmail({
            to: sub.user.email,
            subject: "Your Stemy trial ends in 3 days",
            html: reminderEmail(sub.user.firstName, sub.trialEndsAt),
          });
          console.log(`  ✓ Reminder sent to ${sub.user.email}`);
        } catch (err) {
          console.error(`  ✗ Failed to send reminder to ${sub.user.email}:`, err.message);
        }
      }
    } catch (error) {
      console.error("Trial reminder cron error:", error);
    }
  });

  console.log("📅 Trial ending reminder cron job scheduled (daily at 9 AM)");
};
