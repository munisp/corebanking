import { Router } from "express";
import { deleteNotification } from "../controllers/notification/deleteNotification";
import { getNotifications } from "../controllers/notification/getNotifications";
import { markAllNotificationsRead } from "../controllers/notification/markAllNotificationsRead";
import { markNotificationRead } from "../controllers/notification/markNotificationRead";

const router = Router();

router.route("/").get(getNotifications);
// Static segment must be registered before /:id so it is not shadowed.
router.route("/mark-all-read").put(markAllNotificationsRead);
router.route("/:id/read").put(markNotificationRead);
router.route("/:id").delete(deleteNotification);

export default router;
