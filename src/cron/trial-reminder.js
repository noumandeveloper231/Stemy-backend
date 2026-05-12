import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";
import { trialEndingEmail } from "../utils/email-templates.js";

const TRAIL_END_REMINDER_DAYS = 3;

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
            html: trialEndingEmail(sub.user.firstName, sub.trialEndsAt, process.env.FRONTEND_URL || 'http://localhost:5500'),
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
