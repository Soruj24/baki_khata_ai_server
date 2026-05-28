import { type Request, type Response } from "express";
import { Types } from "mongoose";
import { Shopkeeper } from "../models/Shopkeeper.js";
import { Customer } from "../models/Customer.js";
import { errorResponse, successResponse } from "./responsControllers.ts";

// ─── Types ──────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

interface UpdateShopkeeperBody {
  shopName?: string;
  shopType?: string;
  tradeLicenseNo?: string;
  tinNo?: string;
  logo?: string;
  ownerName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: any;
  businessHours?: any;
  currency?: string;
  bankInfo?: any;
  mobilePayment?: any;
  notificationSettings?: any;
}

// ─── Helper Functions ───────────────────────────────────────────────────

const validateMongoId = (id: string, res: Response): Types.ObjectId | null => {
  if (!Types.ObjectId.isValid(id)) {
    errorResponse(res, {
      statusCode: 400,
      message: "অবৈধ আইডি ফরম্যাট।",
    });
    return null;
  }
  return new Types.ObjectId(id);
};

// ─── Controllers ─────────────────────────────────────────────────────────

/**
 * @desc    Create or update shopkeeper profile
 * @route   POST /api/shopkeeper/profile
 * @access  Private
 */
export const createOrUpdateProfile = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const updateData: UpdateShopkeeperBody = req.body;

    const shopkeeper = await Shopkeeper.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true },
    );

    return successResponse(res, {
      message: "প্রোফাইল সফলভাবে সংরক্ষণ করা হয়েছে।",
      payload: shopkeeper,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ফোন নম্বর বা ইউজার আইডি ইতিমধ্যে ব্যবহৃত হচ্ছে।",
      });
    }
    console.error("প্রোফাইল সংরক্ষণে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
      payload: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

/**
 * @desc    Get shopkeeper profile
 * @route   GET /api/shopkeeper/profile
 * @access  Private
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });

    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message:
          "দোকানের প্রোফাইল পাওয়া যায়নি। অনুগ্রহ করে প্রোফাইল তৈরি করুন।",
      });
    }

    return successResponse(res, {
      payload: shopkeeper,
    });
  } catch (error) {
    console.error("প্রোফাইল পড়তে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/shopkeeper/dashboard
 * @access  Private
 */
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    const customerStats = await Customer.getDashboardStats(shopkeeper._id);

    const stats = {
      shopkeeper: {
        shopName: shopkeeper.shopName,
        status: shopkeeper.status,
        subscription: {
          plan: shopkeeper.subscription.plan,
          status: shopkeeper.subscription.status,
          callsUsed: shopkeeper.subscription.callsUsed,
          callsLimit: shopkeeper.subscription.callsLimit,
          customersLimit: shopkeeper.subscription.customersLimit,
          isActive: shopkeeper.isSubscriptionActive,
        },
        callStats: {
          totalCallsMade: shopkeeper.stats.totalCallsMade,
          successfulCalls: shopkeeper.stats.successfulCalls,
          successRate: shopkeeper.callSuccessRate,
          remainingCalls:
            shopkeeper.subscription.callsLimit -
            shopkeeper.subscription.callsUsed,
        },
      },
      customers: customerStats[0] || {
        totalCustomers: 0,
        activeCustomers: 0,
        clearedCustomers: 0,
        totalDue: 0,
        criticalCount: 0,
        highRiskCount: 0,
      },
    };

    return successResponse(res, {
      payload: stats,
    });
  } catch (error) {
    console.error("ড্যাশবোর্ড ডাটা আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Update subscription
 * @route   PUT /api/shopkeeper/subscription
 * @access  Private
 */
export const updateSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const { plan, status, currentPeriodEnd, callsLimit, customersLimit } =
      req.body;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    const updateData: any = {};
    if (plan) updateData["subscription.plan"] = plan;
    if (status) updateData["subscription.status"] = status;
    if (currentPeriodEnd)
      updateData["subscription.currentPeriodEnd"] = currentPeriodEnd;
    if (callsLimit) updateData["subscription.callsLimit"] = callsLimit;
    if (customersLimit)
      updateData["subscription.customersLimit"] = customersLimit;

    const updatedShopkeeper = await Shopkeeper.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true },
    );

    return successResponse(res, {
      message: "সাবস্ক্রিপশন আপডেট করা হয়েছে।",
      payload: updatedShopkeeper?.subscription,
    });
  } catch (error) {
    console.error("সাবস্ক্রিপশন আপডেটে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Check if shopkeeper can make calls
 * @route   GET /api/shopkeeper/can-call
 * @access  Private
 */
export const checkCallEligibility = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId });
    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    const canCall = shopkeeper.canMakeCall();
    const reasons: string[] = [];

    if (!canCall) {
      if (shopkeeper.status !== "active") {
        reasons.push("দোকানের স্ট্যাটাস সক্রিয় নয়।");
      }
      if (!shopkeeper.isSubscriptionActive) {
        reasons.push("সাবস্ক্রিপশন সক্রিয় নয় বা মেয়াদ শেষ।");
      }
      if (
        shopkeeper.subscription.callsUsed >= shopkeeper.subscription.callsLimit
      ) {
        reasons.push("কল লিমিট শেষ হয়ে গেছে।");
      }
    }

    return successResponse(res, {
      payload: {
        canCall,
        reasons,
        remainingCalls:
          shopkeeper.subscription.callsLimit -
          shopkeeper.subscription.callsUsed,
        subscriptionStatus: shopkeeper.subscription.status,
        trialEndsAt: shopkeeper.subscription.trialEndsAt,
      },
    });
  } catch (error) {
    console.error("কল এলিজিবিলিটি চেক করতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get notification settings
 * @route   GET /api/shopkeeper/notifications/settings
 * @access  Private
 */
export const getNotificationSettings = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId }).select(
      "notificationSettings",
    );
    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    return successResponse(res, {
      payload: shopkeeper.notificationSettings,
    });
  } catch (error) {
    console.error("নোটিফিকেশন সেটিংস পড়তে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Update notification settings
 * @route   PUT /api/shopkeeper/notifications/settings
 * @access  Private
 */
export const updateNotificationSettings = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.userId || req.user?.id;
    const settings = req.body;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOneAndUpdate(
      { userId },
      { $set: { notificationSettings: settings } },
      { new: true, runValidators: true },
    ).select("notificationSettings");

    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    return successResponse(res, {
      message: "নোটিফিকেশন সেটিংস আপডেট করা হয়েছে।",
      payload: shopkeeper.notificationSettings,
    });
  } catch (error) {
    console.error("নোটিফিকেশন সেটিংস আপডেটে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get shopkeeper statistics
 * @route   GET /api/shopkeeper/stats
 * @access  Private
 */
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await Shopkeeper.findOne({ userId }).select(
      "stats subscription",
    );
    if (!shopkeeper) {
      return errorResponse(res, {
        statusCode: 404,
        message: "দোকানের প্রোফাইল পাওয়া যায়নি।",
      });
    }

    return successResponse(res, {
      payload: {
        stats: shopkeeper.stats,
        subscription: {
          callsUsed: shopkeeper.subscription.callsUsed,
          callsLimit: shopkeeper.subscription.callsLimit,
          remainingCalls:
            shopkeeper.subscription.callsLimit -
            shopkeeper.subscription.callsUsed,
        },
      },
    });
  } catch (error) {
    console.error("স্ট্যাটিস্টিক্স আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};
