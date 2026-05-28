import { Router } from "express";
import {
  createOrUpdateProfile,
  getProfile,
  getDashboardStats,
  updateSubscription,
  checkCallEligibility,
  getNotificationSettings,
  updateNotificationSettings,
  getStats,
} from "../controllers/shopkeeperController.js";
import { authenticate } from "../middleware/auth.ts";

const shopkeeperRouter = Router();

// All shopkeeper routes require authentication
shopkeeperRouter.use(authenticate);

// Profile routes
shopkeeperRouter.post("/profile", createOrUpdateProfile);
shopkeeperRouter.get("/profile", getProfile);

// Dashboard and stats
shopkeeperRouter.get("/dashboard", getDashboardStats);
shopkeeperRouter.get("/stats", getStats);

// Subscription routes
shopkeeperRouter.put("/subscription", updateSubscription);
shopkeeperRouter.get("/can-call", checkCallEligibility);

// Notification settings
shopkeeperRouter.get("/notifications/settings", getNotificationSettings);
shopkeeperRouter.put("/notifications/settings", updateNotificationSettings);

export default shopkeeperRouter;
