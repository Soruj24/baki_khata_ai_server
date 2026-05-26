import { type Response, type NextFunction } from "express";
import { notificationService } from "../services/notificationService.ts";
import { successResponse } from "./responsControllers.ts";
import createError from "http-errors";
import { type AuthenticatedRequest } from "../middleware/auth.ts";

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw createError(401, "User not authenticated");
    }

    const notifications =
      await notificationService.getUserNotifications(userId);
    successResponse(res, {
      statusCode: 200,
      message: "Notifications fetched successfully",
      payload: notifications,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id as string);

    if (!notification) {
      throw createError(404, "Notification not found");
    }

    successResponse(res, {
      statusCode: 200,
      message: "Notification marked as read",
      payload: notification,
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw createError(401, "User not authenticated");
    }

    await notificationService.markAllAsRead(userId);

    successResponse(res, {
      statusCode: 200,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};
