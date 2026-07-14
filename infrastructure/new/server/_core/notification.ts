/**
 * Notification helper for 54Bank platform.
 * Sends notifications via a configurable webhook URL (Slack, Teams, custom endpoint).
 *
 * Configuration:
 *   NOTIFICATION_WEBHOOK_URL — webhook URL to POST notifications to (optional)
 *   NOTIFICATION_FROM_EMAIL  — sender email for email notifications (optional)
 */
import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const title = payload.title?.trim();
  const content = payload.content?.trim();

  if (!isNonEmptyString(title)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required" });
  }
  if (!isNonEmptyString(content)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required" });
  }
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Title exceeds ${TITLE_MAX_LENGTH} characters` });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Content exceeds ${CONTENT_MAX_LENGTH} characters` });
  }

  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    // No webhook configured — log to console (useful in dev/test)
    console.info(`[Notification] ${title}: ${content}`);
    return true;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content, timestamp: new Date().toISOString() }),
    });
    return response.ok;
  } catch (error) {
    console.error("[Notification] Failed to deliver notification:", error);
    return false;
  }
}
