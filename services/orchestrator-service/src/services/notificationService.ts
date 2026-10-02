import logger from "../config/logger.config";
import { INotificationPayload } from "../types/notification";
import { readEnv } from "../config/readEnv.config";
import { DaprClientService } from "../lib/daprClient";

// OB-02: real Dapr publish. Previously the publish call was commented out and
// notifications (welcome e-mail, KYC link) were fabricated — nothing was sent.
// Throws on failure so the calling Temporal activity retries.
const NOTIFICATIONS_TOPIC = "notifications.send";

class NotificationService {
  event = async (notificationPayload: INotificationPayload) => {
    const pubsubName = (readEnv("DAPR_PUBSUB_NAME") as string) || "pubsub";
    const topicPrefix = (readEnv("DAPR_PUBSUB_TOPIC_PREFIX") as string) || "";
    const topic = `${topicPrefix}${NOTIFICATIONS_TOPIC}`;

    logger.info(
      `Publishing notification event to ${pubsubName}/${topic} type=${notificationPayload.type}`,
    );

    await DaprClientService.getInstance().publish<INotificationPayload>(
      pubsubName,
      topic,
      notificationPayload,
    );
  };
}

export const notificationService = new NotificationService();
