import { type Request, type Response } from "express";
import { Types } from "mongoose";
import {
  Customer,
  type ICustomer,
  type CustomerRisk,
  type CustomerStatus,
} from "../models/Customer.ts";
import { Shopkeeper } from "../models/Shopkeeper.ts";
import { errorResponse, successResponse } from "./responsControllers.ts";

// ─── Types ──────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

interface CreateCustomerBody {
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  photo?: string;
  nidNo?: string;
  address?: any;
  relationship?: string;
  referredBy?: string;
  totalDue?: number;
  creditLimit?: {
    amount?: number;
    isCustom?: boolean;
  };
  callPreference?: any;
  notes?: string;
  tags?: string[];
}

interface UpdateCustomerBody extends Partial<CreateCustomerBody> {
  status?: CustomerStatus;
  riskLevel?: CustomerRisk;
}

// ─── Helper Functions ───────────────────────────────────────────────────

const getShopkeeperByUserId = async (userId: string, res: Response) => {
  const shopkeeper = await Shopkeeper.findOne({ userId });
  if (!shopkeeper) {
    errorResponse(res, {
      statusCode: 404,
      message:
        "দোকানের প্রোফাইল পাওয়া যায়নি। অনুগ্রহ করে প্রথমে প্রোফাইল তৈরি করুন।",
    });
    return null;
  }
  return shopkeeper;
};

// ─── Controllers ─────────────────────────────────────────────────────────

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Private
 */
export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    // Check customer limit
    const currentCustomerCount = await Customer.countDocuments({
      shopkeeperId: shopkeeper._id,
    });

    if (currentCustomerCount >= shopkeeper.subscription.customersLimit) {
      return errorResponse(res, {
        statusCode: 403,
        message: `আপনার কাস্টমার লিমিট (${shopkeeper.subscription.customersLimit}) পূর্ণ হয়ে গেছে। অনুগ্রহ করে প্ল্যান আপগ্রেড করুন।`,
      });
    }

    const customerData: CreateCustomerBody = req.body;

    // Check for duplicate phone
    const existingCustomer = await Customer.findOne({
      shopkeeperId: shopkeeper._id,
      phone: customerData.phone,
    });

    if (existingCustomer) {
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ফোন নম্বরটি ইতিমধ্যে আপনার কাস্টমার লিস্টে আছে।",
      });
    }

    // Handle referredBy
    let referredById = null;
    if (customerData.referredBy) {
      if (Types.ObjectId.isValid(customerData.referredBy)) {
        referredById = new Types.ObjectId(customerData.referredBy);
      }
    }

    const customer = new Customer({
      shopkeeperId: shopkeeper._id,
      name: customerData.name,
      phone: customerData.phone,
      alternatePhone: customerData.alternatePhone,
      email: customerData.email,
      photo: customerData.photo,
      nidNo: customerData.nidNo,
      address: customerData.address,
      relationship: customerData.relationship || "regular",
      referredBy: referredById,
      totalDue: customerData.totalDue || 0,
      creditLimit: customerData.creditLimit || {
        amount: 5000,
        isCustom: false,
      },
      callPreference: customerData.callPreference,
      notes: customerData.notes,
      tags: customerData.tags,
    });

    await customer.save();

    // Update shopkeeper stats
    await Shopkeeper.updateOne(
      { _id: shopkeeper._id },
      {
        $inc: {
          "stats.totalCustomers": 1,
          "stats.activeCustomers": 1,
          "stats.totalDueAmount": customer.totalDue,
        },
      },
    );

    return successResponse(res, {
      statusCode: 201,
      message: "কাস্টমার সফলভাবে যোগ করা হয়েছে।",
      payload: customer,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ফোন নম্বরটি ইতিমধ্যে আপনার কাস্টমার লিস্টে আছে।",
      });
    }
    console.error("কাস্টমার তৈরি করতে ত্রুটি:", error);
    return errorResponse(res, {
      statusCode: 500,
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
      payload: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

/**
 * @desc    Get all customers with filtering and pagination
 * @route   GET /api/customers
 * @access  Private
 */
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Filters
    const filters: any = { shopkeeperId: shopkeeper._id };

    if (req.query.status) filters.status = req.query.status;
    if (req.query.riskLevel) filters.riskLevel = req.query.riskLevel;
    if (req.query.relationship) filters.relationship = req.query.relationship;
    if (req.query.hasDue === "true") filters.totalDue = { $gt: 0 };
    if (req.query.hasDue === "false") filters.totalDue = 0;
    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { phone: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Sorting
    const sortField = (req.query.sortBy as string) || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort: any = { [sortField]: sortOrder };

    // Execute query
    const [customers, total] = await Promise.all([
      Customer.find(filters)
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .populate("referredBy", "name phone")
        .lean(),
      Customer.countDocuments(filters),
    ]);

    return successResponse(res, {
      payload: {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          status: req.query.status || null,
          riskLevel: req.query.riskLevel || null,
          hasDue: req.query.hasDue || null,
          search: req.query.search || null,
        },
      },
    });
  } catch (error) {
    console.error("কাস্টমার লিস্ট আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get single customer by ID
 * @route   GET /api/customers/:id
 * @access  Private
 */
export const getCustomerById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const customerId = req.params.id;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    const id = customerId as string;
    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: "অবৈধ আইডি ফরম্যাট।",
      });
    }
    const customerObjectId = new Types.ObjectId(id);

    const customer = await Customer.findOne({
      _id: customerObjectId,
      shopkeeperId: shopkeeper._id,
    })
      .populate("referredBy", "name phone totalDue")
      .lean();

    if (!customer) {
      return errorResponse(res, {
        statusCode: 404,
        message: "কাস্টমার পাওয়া যায়নি।",
      });
    }

    return successResponse(res, {
      payload: customer,
    });
  } catch (error) {
    console.error("কাস্টমার তথ্য আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Private
 */
export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const customerId = req.params.id;
    const updateData: UpdateCustomerBody = req.body;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const id = customerId as string;
    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(res, {
        statusCode: 400,
        message: "অবৈধ আইডি ফরম্যাট।",
      });
    }
    const customerObjectId = new Types.ObjectId(id);

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    // Check if updating phone number and it's not duplicate
    if (updateData.phone) {
      const existingCustomer = await Customer.findOne({
        shopkeeperId: shopkeeper._id,
        phone: updateData.phone,
        _id: { $ne: customerObjectId },
      });

      if (existingCustomer) {
        return errorResponse(res, {
          statusCode: 409,
          message: "এই ফোন নম্বরটি ইতিমধ্যে অন্য কাস্টমারের সাথে যুক্ত।",
        });
      }
    }

    const oldCustomer = await Customer.findOne({
      _id: customerObjectId,
      shopkeeperId: shopkeeper._id,
    });

    if (!oldCustomer) {
      return errorResponse(res, {
        statusCode: 404,
        message: "কাস্টমার পাওয়া যায়নি।",
      });
    }

    // Recalculate risk level if due amount changed
    if (
      updateData.totalDue !== undefined &&
      updateData.totalDue !== oldCustomer.totalDue
    ) {
      oldCustomer.totalDue = updateData.totalDue;
      updateData.riskLevel = oldCustomer.recalculateRisk();
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: customerObjectId, shopkeeperId: shopkeeper._id },
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate("referredBy", "name phone");

    if (!customer) {
      return errorResponse(res, {
        statusCode: 404,
        message: "কাস্টমার আপডেট করতে ব্যর্থ হয়েছে।",
      });
    }

    // Update shopkeeper stats if totalDue changed
    if (
      updateData.totalDue !== undefined &&
      updateData.totalDue !== oldCustomer.totalDue
    ) {
      const dueDifference = updateData.totalDue - oldCustomer.totalDue;
      await Shopkeeper.updateOne(
        { _id: shopkeeper._id },
        { $inc: { "stats.totalDueAmount": dueDifference } },
      );
    }

    return successResponse(res, {
      message: "কাস্টমারের তথ্য আপডেট করা হয়েছে।",
      payload: customer,
    });
  } catch (error) {
    console.error("কাস্টমার আপডেট করতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Private
 */
export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const customerId = req.params.id as string | undefined;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    if (!customerId || !Types.ObjectId.isValid(customerId)) {
      return errorResponse(res, {
        statusCode: 400,
        message: "অবৈধ আইডি ফরম্যাট।",
      });
    }
    const customerObjectId = new Types.ObjectId(customerId);

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    const customer = await Customer.findOneAndDelete({
      _id: customerObjectId,
      shopkeeperId: shopkeeper._id,
    });

    if (!customer) {
      return errorResponse(res, {
        statusCode: 404,
        message: "কাস্টমার পাওয়া যায়নি।",
      });
    }

    // Update shopkeeper stats
    const statusUpdate = customer.status === "active" ? -1 : 0;
    await Shopkeeper.updateOne(
      { _id: shopkeeper._id },
      {
        $inc: {
          "stats.totalCustomers": -1,
          "stats.activeCustomers": statusUpdate,
          "stats.totalDueAmount": -customer.totalDue,
        },
      },
    );

    return successResponse(res, {
      message: "কাস্টমার সফলভাবে ডিলিট করা হয়েছে।",
    });
  } catch (error) {
    console.error("কাস্টমার ডিলিট করতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get overdue customers
 * @route   GET /api/customers/overdue
 * @access  Private
 */
export const getOverdueCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const thresholdDays = parseInt(req.query.days as string) || 7;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    const overdueCustomers = await Customer.findOverdue(
      shopkeeper._id,
      thresholdDays,
    );

    // Add warning levels
    const customersWithWarnings = overdueCustomers.map((customer: any) => ({
      ...customer.toObject(),
      warningLevel:
        customer.riskLevel === "critical"
          ? "urgent"
          : customer.riskLevel === "high"
            ? "warning"
            : "info",
      message:
        customer.riskLevel === "critical"
          ? "অবিলম্বে যোগাযোগ প্রয়োজন!"
          : customer.riskLevel === "high"
            ? "দ্রুত ব্যবস্থা নিন"
            : `বাকি আছে ${customer.overdueDays} দিন`,
    }));

    return successResponse(res, {
      payload: {
        customers: customersWithWarnings,
        count: overdueCustomers.length,
        thresholdDays,
      },
    });
  } catch (error) {
    console.error("ওভারডিউ কাস্টমার লিস্ট আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get customers for calling (AI call queue)
 * @route   GET /api/customers/call-queue
 * @access  Private
 */
export const getCallQueue = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    // Check if shopkeeper can make calls
    if (!shopkeeper.canMakeCall()) {
      return errorResponse(res, {
        statusCode: 403,
        message: "আপনার কল করার অনুমতি নেই। অনুগ্রহ করে সাবস্ক্রিপশন চেক করুন।",
      });
    }

    // Get customers sorted by priority
    const callQueue = await Customer.find({
      shopkeeperId: shopkeeper._id,
      status: "active",
      totalDue: { $gt: 0 },
      "callPreference.doNotCall": { $ne: true },
      $or: [
        {
          "callHistory.lastCalledAt": {
            $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        { "callHistory.lastCalledAt": null },
      ],
    })
      .sort({ riskLevel: -1, totalDue: -1, "callHistory.lastCalledAt": 1 })
      .limit(limit)
      .lean();

    // Add call priority score
    const prioritizedQueue = callQueue.map((customer) => ({
      ...customer,
      callPriority:
        customer.riskLevel === "critical"
          ? 100
          : customer.riskLevel === "high"
            ? 80
            : customer.riskLevel === "medium"
              ? 50
              : 30,
    }));

    return successResponse(res, {
      payload: {
        customers: prioritizedQueue,
        count: prioritizedQueue.length,
        remainingCalls:
          shopkeeper.subscription.callsLimit -
          shopkeeper.subscription.callsUsed,
      },
    });
  } catch (error) {
    console.error("কল কিউ তৈরিতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Get customer statistics summary
 * @route   GET /api/customers/stats/summary
 * @access  Private
 */
export const getCustomerStatsSummary = async (
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

    const shopkeeper = await getShopkeeperByUserId(userId, res);
    if (!shopkeeper) return;

    const stats = await Customer.getDashboardStats(shopkeeper._id);
    const totalDueDistribution = await Customer.aggregate([
      { $match: { shopkeeperId: shopkeeper._id } },
      {
        $bucket: {
          groupBy: "$totalDue",
          boundaries: [0, 1000, 5000, 10000, 50000, Infinity],
          default: "50000+",
          output: {
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalDue" },
          },
        },
      },
    ]);

    return successResponse(res, {
      payload: {
        overview: stats[0] || {
          totalCustomers: 0,
          activeCustomers: 0,
          clearedCustomers: 0,
          totalDue: 0,
          criticalCount: 0,
          highRiskCount: 0,
        },
        dueDistribution: totalDueDistribution,
      },
    });
  } catch (error) {
    console.error("কাস্টমার স্ট্যাটিস্টিক্স আনতে ত্রুটি:", error);
    return errorResponse(res, {
      message: "সার্ভার ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
    });
  }
};
