import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { IShopkeeper } from "./Shopkeeper.js";

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMA INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ICustomerAddress {
  street?: string;
  area?: string;
  thana?: string;
  district?: string;
  division?: string;
  postalCode?: string;
  landmark?: string;
}

export interface ICreditLimit {
  amount: number;
  isCustom: boolean;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  expiryDate?: Date;
}

export interface ICallPreference {
  preferredTime: "morning" | "afternoon" | "evening" | "any";
  preferredDays: string[];
  doNotCall: boolean;
  doNotCallReason?: string;
  prefersSMS: boolean;
  prefersEmail: boolean;
  language: "bn" | "en";
  bestContactNumber?: string;
  notes?: string;
}

export interface IPaymentBehavior {
  avgPaymentDays: number;
  totalTransactions: number;
  totalPaid: number;
  onTimePayments: number;
  latePayments: number;
  missedPayments: number;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  largestPayment?: number;
  longestDelayDays?: number;
}

export interface ICallHistory {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  failedCalls: number;
  lastCalledAt?: Date;
  lastCallStatus?: "answered" | "missed" | "failed" | null;
  lastCallDuration?: number;
  promisedPayDate?: Date;
  promisedPayAmount?: number;
  lastCallNote?: string;
}

export interface ICustomerNote {
  content: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  type: "general" | "call" | "payment" | "warning";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerRisk = "low" | "medium" | "high" | "critical";
export type CustomerStatus = "active" | "cleared" | "blocked" | "inactive";
export type CustomerRelationship =
  | "regular"
  | "wholesale"
  | "family"
  | "friend"
  | "new"
  | "vip";

export interface ICustomer extends Document {
  _id: Types.ObjectId;

  // Relationships
  shopkeeperId: Types.ObjectId | IShopkeeper;

  // Basic Information
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  photo?: string;
  nidNo?: string;
  dateOfBirth?: Date;
  occupation?: string;
  address?: ICustomerAddress;

  // Business Relationship
  relationship: CustomerRelationship;
  referredBy?: Types.ObjectId | ICustomer;
  referredCustomers?: Types.ObjectId[];

  // Financial Information
  totalDue: number;
  totalPurchased: number;
  totalPaid: number;
  creditLimit: ICreditLimit;
  lastTransactionDate?: Date;
  oldestUnpaidDate?: Date;
  lastPaymentDate?: Date;

  // Status & Risk
  status: CustomerStatus;
  riskLevel: CustomerRisk;
  riskFactors?: string[];
  blacklistedAt?: Date;
  blacklistReason?: string;

  // Preferences
  callPreference: ICallPreference;

  // Analytics
  paymentBehavior: IPaymentBehavior;
  callHistory: ICallHistory;

  // Additional Information
  notes?: string;
  customerNotes?: ICustomerNote[];
  tags?: string[];
  metadata?: Map<string, any>;

  // Virtuals
  creditUtilization: number;
  isOverCreditLimit: boolean;
  overdueDays: number;
  paymentSuccessRate: number | null;
  daysSinceLastContact: number;
  isHighPriority: boolean;

  // Instance Methods
  recalculateRisk(): CustomerRisk;
  updateAfterTransaction(
    type: "credit" | "payment",
    amount: number,
    transactionDate: Date,
    transactionId?: Types.ObjectId,
  ): Promise<void>;
  addNote(
    content: string,
    createdBy: Types.ObjectId,
    type?: ICustomerNote["type"],
  ): Promise<void>;
  updateCallHistory(
    status: ICallHistory["lastCallStatus"],
    duration?: number,
  ): Promise<void>;
  canMakeCall(): boolean;
  getRiskScore(): number;
  getRecommendedAction(): string;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const CustomerAddressSchema = new Schema<ICustomerAddress>(
  {
    street: { type: String, trim: true },
    area: { type: String, trim: true },
    thana: { type: String, trim: true },
    district: { type: String, trim: true },
    division: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    landmark: { type: String, trim: true },
  },
  { _id: false },
);

const CreditLimitSchema = new Schema<ICreditLimit>(
  {
    amount: { type: Number, default: 5000, min: 0 },
    isCustom: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Shopkeeper" },
    approvedAt: { type: Date },
    expiryDate: { type: Date },
  },
  { _id: false },
);

const CallPreferenceSchema = new Schema<ICallPreference>(
  {
    preferredTime: {
      type: String,
      enum: ["morning", "afternoon", "evening", "any"],
      default: "any",
    },
    preferredDays: {
      type: [String],
      enum: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"],
      default: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"],
    },
    doNotCall: { type: Boolean, default: false },
    doNotCallReason: { type: String },
    prefersSMS: { type: Boolean, default: false },
    prefersEmail: { type: Boolean, default: false },
    language: { type: String, enum: ["bn", "en"], default: "bn" },
    bestContactNumber: { type: String, trim: true },
    notes: { type: String },
  },
  { _id: false },
);

const PaymentBehaviorSchema = new Schema<IPaymentBehavior>(
  {
    avgPaymentDays: { type: Number, default: 0, min: 0 },
    totalTransactions: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    onTimePayments: { type: Number, default: 0, min: 0 },
    latePayments: { type: Number, default: 0, min: 0 },
    missedPayments: { type: Number, default: 0, min: 0 },
    lastPaymentDate: { type: Date },
    lastPaymentAmount: { type: Number, min: 0 },
    largestPayment: { type: Number, min: 0 },
    longestDelayDays: { type: Number, min: 0 },
  },
  { _id: false },
);

const CallHistorySchema = new Schema<ICallHistory>(
  {
    totalCalls: { type: Number, default: 0, min: 0 },
    answeredCalls: { type: Number, default: 0, min: 0 },
    missedCalls: { type: Number, default: 0, min: 0 },
    failedCalls: { type: Number, default: 0, min: 0 },
    lastCalledAt: { type: Date },
    lastCallStatus: {
      type: String,
      enum: ["answered", "missed", "failed", null],
      default: null,
    },
    lastCallDuration: { type: Number, min: 0 },
    promisedPayDate: { type: Date },
    promisedPayAmount: { type: Number, min: 0 },
    lastCallNote: { type: String },
  },
  { _id: false },
);

const CustomerNoteSchema = new Schema<ICustomerNote>(
  {
    content: { type: String, required: true, maxlength: 500 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Shopkeeper",
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ["general", "call", "payment", "warning"],
      default: "general",
    },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const CustomerSchema = new Schema<ICustomer>(
  {
    // Relationships
    shopkeeperId: {
      type: Schema.Types.ObjectId,
      ref: "Shopkeeper",
      required: [true, "দোকানদারের রেফারেন্স আবশ্যক"],
      index: true,
    },

    // Basic Information
    name: {
      type: String,
      required: [true, "কাস্টমারের নাম আবশ্যক"],
      trim: true,
      maxlength: [100, "নাম ১০০ অক্ষরের বেশি হতে পারবে না"],
      index: true,
    },
    phone: {
      type: String,
      required: [true, "ফোন নম্বর আবশ্যক"],
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^(?:\+8801|01)[3-9]\d{8}$/.test(v),
        message: "বৈধ বাংলাদেশি ফোন নম্বর দিন (01XXXXXXXXX)",
      },
    },
    alternatePhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^(?:\+8801|01)[3-9]\d{8}$/.test(v),
        message: "বৈধ বাংলাদেশি ফোন নম্বর দিন",
      },
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "বৈধ ইমেইল ঠিকানা দিন"],
    },
    photo: { type: String, trim: true },
    nidNo: {
      type: String,
      trim: true,
      sparse: true,
      select: false, // Sensitive data - hidden by default
    },
    dateOfBirth: { type: Date },
    occupation: { type: String, trim: true },
    address: { type: CustomerAddressSchema, default: () => ({}) },

    // Business Relationship
    relationship: {
      type: String,
      enum: ["regular", "wholesale", "family", "friend", "new", "vip"],
      default: "regular",
      index: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    referredCustomers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Customer",
      },
    ],

    // Financial Information
    totalDue: {
      type: Number,
      default: 0,
      min: [0, "বাকি ঋণাত্মক হতে পারবে না"],
      index: true,
    },
    totalPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditLimit: { type: CreditLimitSchema, default: () => ({}) },
    lastTransactionDate: { type: Date, index: true },
    oldestUnpaidDate: { type: Date, index: true },
    lastPaymentDate: { type: Date },

    // Status & Risk
    status: {
      type: String,
      enum: ["active", "cleared", "blocked", "inactive"],
      default: "active",
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    riskFactors: [String],
    blacklistedAt: { type: Date },
    blacklistReason: { type: String },

    // Preferences
    callPreference: { type: CallPreferenceSchema, default: () => ({}) },

    // Analytics
    paymentBehavior: { type: PaymentBehaviorSchema, default: () => ({}) },
    callHistory: { type: CallHistorySchema, default: () => ({}) },

    // Additional Information
    notes: { type: String, maxlength: 1000 },
    customerNotes: [CustomerNoteSchema],
    tags: {
      type: [String],
      default: [],
      index: true,
      validate: {
        validator: (v: string[]) => v.length <= 20,
        message: "সর্বোচ্চ ২০টি ট্যাগ দেওয়া যাবে",
      },
    },
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// Unique compound index for shopkeeper + phone
CustomerSchema.index({ shopkeeperId: 1, phone: 1 }, { unique: true });

// Common query indexes
CustomerSchema.index({ shopkeeperId: 1, status: 1, totalDue: -1 });
CustomerSchema.index({ shopkeeperId: 1, riskLevel: 1, totalDue: -1 });
CustomerSchema.index({ shopkeeperId: 1, lastTransactionDate: -1 });
CustomerSchema.index({ shopkeeperId: 1, createdAt: -1 });
CustomerSchema.index({ shopkeeperId: 1, tags: 1 });

// Search index
CustomerSchema.index(
  { name: "text", phone: "text", email: "text" },
  {
    weights: { name: 3, phone: 2, email: 1 },
    name: "customer_search_index",
  },
);

// Overdue queries
CustomerSchema.index({
  shopkeeperId: 1,
  status: 1,
  oldestUnpaidDate: 1,
  totalDue: 1,
});

// Call queue queries
CustomerSchema.index({
  shopkeeperId: 1,
  status: 1,
  riskLevel: -1,
  "callHistory.lastCalledAt": 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

CustomerSchema.virtual("creditUtilization").get(function (this: ICustomer) {
  if (!this.creditLimit?.amount || this.creditLimit.amount === 0) return 0;
  return Number(((this.totalDue / this.creditLimit.amount) * 100).toFixed(2));
});

CustomerSchema.virtual("isOverCreditLimit").get(function (this: ICustomer) {
  return this.totalDue > (this.creditLimit?.amount ?? Infinity);
});

CustomerSchema.virtual("overdueDays").get(function (this: ICustomer) {
  if (!this.oldestUnpaidDate) return 0;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - this.oldestUnpaidDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
});

CustomerSchema.virtual("paymentSuccessRate").get(function (this: ICustomer) {
  const total = this.paymentBehavior?.totalTransactions ?? 0;
  if (total === 0) return null;
  const onTime = this.paymentBehavior?.onTimePayments ?? 0;
  return Number(((onTime / total) * 100).toFixed(2));
});

CustomerSchema.virtual("daysSinceLastContact").get(function (this: ICustomer) {
  if (!this.callHistory?.lastCalledAt) return 999;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - this.callHistory.lastCalledAt.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
});

CustomerSchema.virtual("isHighPriority").get(function (this: ICustomer) {
  return (
    this.riskLevel === "critical" ||
    (this.riskLevel === "high" && this.overdueDays > 14) ||
    this.isOverCreditLimit
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

CustomerSchema.methods.getRiskScore = function (this: ICustomer): number {
  let score = 0;
  const due = this.totalDue;
  const limit = this.creditLimit?.amount ?? 5000;
  const days = this.overdueDays;
  const missedCalls = this.callHistory?.missedCalls ?? 0;
  const latePayments = this.paymentBehavior?.latePayments ?? 0;
  const totalTransactions = this.paymentBehavior?.totalTransactions ?? 0;

  // Due amount factor (0-30 points)
  if (due > limit * 0.9) score += 30;
  else if (due > limit * 0.7) score += 20;
  else if (due > limit * 0.5) score += 15;
  else if (due > limit * 0.3) score += 10;
  else if (due > limit * 0.1) score += 5;

  // Overdue days factor (0-35 points)
  if (days > 60) score += 35;
  else if (days > 30) score += 25;
  else if (days > 14) score += 15;
  else if (days > 7) score += 10;
  else if (days > 3) score += 5;

  // Missed calls factor (0-20 points)
  if (missedCalls >= 5) score += 20;
  else if (missedCalls >= 3) score += 15;
  else if (missedCalls >= 1) score += 10;

  // Payment behavior factor (0-15 points)
  if (totalTransactions > 0) {
    const lateRate = latePayments / totalTransactions;
    if (lateRate > 0.5) score += 15;
    else if (lateRate > 0.3) score += 10;
    else if (lateRate > 0.1) score += 5;
  }

  return Math.min(100, score);
};

CustomerSchema.methods.recalculateRisk = function (
  this: ICustomer,
): CustomerRisk {
  const score = this.getRiskScore();
  const riskFactors: string[] = [];

  // Determine risk level
  let riskLevel: CustomerRisk;
  if (score >= 70) riskLevel = "critical";
  else if (score >= 45) riskLevel = "high";
  else if (score >= 20) riskLevel = "medium";
  else riskLevel = "low";

  // Identify risk factors
  if (this.totalDue > (this.creditLimit?.amount ?? 5000) * 0.8) {
    riskFactors.push("credit_limit_near_exceeded");
  }
  if (this.overdueDays > 30) {
    riskFactors.push("long_term_overdue");
  }
  if ((this.callHistory?.missedCalls ?? 0) >= 3) {
    riskFactors.push("multiple_missed_calls");
  }
  if (
    (this.paymentBehavior?.latePayments ?? 0) >
    (this.paymentBehavior?.onTimePayments ?? 0)
  ) {
    riskFactors.push("frequent_late_payments");
  }
  if (this.status !== "active") {
    riskFactors.push("inactive_status");
  }

  this.riskFactors = riskFactors;
  this.riskLevel = riskLevel;

  return riskLevel;
};

CustomerSchema.methods.getRecommendedAction = function (
  this: ICustomer,
): string {
  const score = this.getRiskScore();

  if (score >= 70) {
    return "তাত্ক্ষণিক কল প্রয়োজন। সম্ভব হলে পার্সোনাল ভিজিট করুন।";
  }
  if (score >= 45) {
    return "আজকের মধ্যে কল করুন। পেমেন্ট প্ল্যান আলোচনা করুন।";
  }
  if (score >= 20) {
    return "সপ্তাহে ২ বার কল করুন। রিমাইন্ডার SMS পাঠান।";
  }
  return "নিয়মিত ফলোআপ চালিয়ে যান।";
};

CustomerSchema.methods.updateAfterTransaction = async function (
  this: ICustomer,
  type: "credit" | "payment",
  amount: number,
  transactionDate: Date,
  _transactionId?: Types.ObjectId,
): Promise<void> {
  const update: any = {
    lastTransactionDate: transactionDate,
  };

  if (type === "credit") {
    // Credit sale
    update.totalDue = this.totalDue + amount;
    update.totalPurchased = (this.totalPurchased || 0) + amount;

    if (!this.oldestUnpaidDate && this.totalDue === 0) {
      update.oldestUnpaidDate = transactionDate;
    }

    update["paymentBehavior.totalTransactions"] =
      (this.paymentBehavior?.totalTransactions ?? 0) + 1;
  } else {
    // Payment received
    const newDue = Math.max(0, this.totalDue - amount);
    update.totalDue = newDue;
    update.totalPaid = (this.totalPaid || 0) + amount;
    update.lastPaymentDate = transactionDate;

    update["paymentBehavior.lastPaymentDate"] = transactionDate;
    update["paymentBehavior.lastPaymentAmount"] = amount;
    update["paymentBehavior.totalPaid"] =
      (this.paymentBehavior?.totalPaid || 0) + amount;

    if (amount > (this.paymentBehavior?.largestPayment || 0)) {
      update["paymentBehavior.largestPayment"] = amount;
    }

    if (newDue === 0) {
      update.status = "cleared";
      update.oldestUnpaidDate = null;
    }
  }

  // Recalculate risk based on new data
  const riskLevel = this.recalculateRisk();
  update.riskLevel = riskLevel;

  await this.updateOne({ $set: update });
};

CustomerSchema.methods.addNote = async function (
  this: ICustomer,
  content: string,
  createdBy: Types.ObjectId,
  type: ICustomerNote["type"] = "general",
): Promise<void> {
  const note = {
    content,
    createdBy,
    createdAt: new Date(),
    type,
  };

  await this.updateOne({
    $push: { customerNotes: note },
  });
};

CustomerSchema.methods.updateCallHistory = async function (
  this: ICustomer,
  status: ICallHistory["lastCallStatus"],
  duration?: number,
): Promise<void> {
  const update: any = {
    "callHistory.lastCalledAt": new Date(),
    "callHistory.lastCallStatus": status,
    $inc: { "callHistory.totalCalls": 1 },
  };

  if (status === "answered") {
    update.$inc!["callHistory.answeredCalls"] = 1;
    if (duration) update["callHistory.lastCallDuration"] = duration;
  } else if (status === "missed") {
    update.$inc!["callHistory.missedCalls"] = 1;
  } else if (status === "failed") {
    update.$inc!["callHistory.failedCalls"] = 1;
  }

  await this.updateOne(update);
};

CustomerSchema.methods.canMakeCall = function (this: ICustomer): boolean {
  if (this.callPreference?.doNotCall) return false;
  if (this.status !== "active") return false;
  if (this.totalDue <= 0) return false;

  // Don't call too frequently (minimum 3 days between calls)
  if (this.callHistory?.lastCalledAt) {
    const daysSinceLastCall = Math.floor(
      (Date.now() - this.callHistory.lastCalledAt.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastCall < 3) return false;
  }

  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

interface ICustomerModel extends Model<ICustomer> {
  findOverdue(
    shopkeeperId: Types.ObjectId,
    thresholdDays?: number,
    limit?: number,
  ): Promise<ICustomer[]>;
  getDashboardStats(shopkeeperId: Types.ObjectId): Promise<any>;
  findHighRiskCustomers(
    shopkeeperId: Types.ObjectId,
    limit?: number,
  ): Promise<ICustomer[]>;
  getCallQueue(
    shopkeeperId: Types.ObjectId,
    limit?: number,
  ): Promise<ICustomer[]>;
  bulkUpdateRisk(shopkeeperId: Types.ObjectId): Promise<void>;
}

CustomerSchema.statics.findOverdue = function (
  shopkeeperId: Types.ObjectId,
  thresholdDays: number = 7,
  limit: number = 50,
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

  return this.find({
    shopkeeperId,
    status: "active",
    totalDue: { $gt: 0 },
    "callPreference.doNotCall": { $ne: true },
    $or: [
      { oldestUnpaidDate: { $lte: cutoffDate } },
      { lastTransactionDate: { $lte: cutoffDate } },
    ],
  })
    .sort({ riskLevel: -1, totalDue: -1, oldestUnpaidDate: 1 })
    .limit(limit)
    .populate("referredBy", "name phone");
};

CustomerSchema.statics.findHighRiskCustomers = function (
  shopkeeperId: Types.ObjectId,
  limit: number = 20,
) {
  return this.find({
    shopkeeperId,
    status: "active",
    riskLevel: { $in: ["high", "critical"] },
    totalDue: { $gt: 0 },
  })
    .sort({ riskLevel: -1, totalDue: -1 })
    .limit(limit);
};

CustomerSchema.statics.getCallQueue = function (
  shopkeeperId: Types.ObjectId,
  limit: number = 30,
) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return this.find({
    shopkeeperId,
    status: "active",
    totalDue: { $gt: 0 },
    "callPreference.doNotCall": { $ne: true },
    $or: [
      { "callHistory.lastCalledAt": { $lt: sevenDaysAgo } },
      { "callHistory.lastCalledAt": null },
    ],
  })
    .sort({ riskLevel: -1, totalDue: -1, "callHistory.lastCalledAt": 1 })
    .limit(limit)
    .select("name phone totalDue riskLevel callPreference");
};

CustomerSchema.statics.getDashboardStats = async function (
  shopkeeperId: Types.ObjectId,
) {
  const stats = await this.aggregate([
    { $match: { shopkeeperId } },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              activeCustomers: {
                $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
              },
              clearedCustomers: {
                $sum: { $cond: [{ $eq: ["$status", "cleared"] }, 1, 0] },
              },
              totalDue: { $sum: "$totalDue" },
              avgDue: { $avg: "$totalDue" },
              criticalCount: {
                $sum: { $cond: [{ $eq: ["$riskLevel", "critical"] }, 1, 0] },
              },
              highRiskCount: {
                $sum: { $cond: [{ $eq: ["$riskLevel", "high"] }, 1, 0] },
              },
              mediumRiskCount: {
                $sum: { $cond: [{ $eq: ["$riskLevel", "medium"] }, 1, 0] },
              },
              lowRiskCount: {
                $sum: { $cond: [{ $eq: ["$riskLevel", "low"] }, 1, 0] },
              },
            },
          },
        ],
        riskDistribution: [
          {
            $group: {
              _id: "$riskLevel",
              count: { $sum: 1 },
              totalDue: { $sum: "$totalDue" },
            },
          },
        ],
        statusDistribution: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],
        recentCustomers: [
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          { $project: { name: 1, phone: 1, totalDue: 1, createdAt: 1 } },
        ],
      },
    },
  ]);

  return stats[0];
};

CustomerSchema.statics.bulkUpdateRisk = async function (
  shopkeeperId: Types.ObjectId,
) {
  const customers = await this.find({ shopkeeperId });

  for (const customer of customers) {
    customer.recalculateRisk();
    await customer.save();
  }

  return customers.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

// Auto-update risk level before save
CustomerSchema.pre("save", function () {
  if (
    this.isModified("totalDue") ||
    this.isModified("oldestUnpaidDate") ||
    this.isModified("callHistory")
  ) {
    this.recalculateRisk();
  }
});

// Cascade delete referredBy references
CustomerSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await this.model("Customer").updateMany(
    { referredBy: this._id },
    { $set: { referredBy: null } },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const Customer =
  (mongoose.models.Customer as ICustomerModel) ||
  mongoose.model<ICustomer, ICustomerModel>("Customer", CustomerSchema);
