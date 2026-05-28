import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose, { Document, Model, Schema, Types } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMA INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface IAddress {
  street?: string;
  area?: string;
  thana?: string;
  district?: string;
  division?: string;
  postalCode?: string;
}

export interface IBusinessHours {
  open: string;
  close: string;
  closedDays: string[];
}

export interface IBankInfo {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
}

export interface IMobilePayment {
  bkash?: string;
  nagad?: string;
  rocket?: string;
  upay?: string;
}

export interface IRefreshToken {
  token: string;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IShopkeeperSubscription {
  plan: "free" | "basic" | "pro" | "enterprise";
  status: "active" | "expired" | "cancelled" | "trial";
  trialEndsAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  callsUsed: number;
  callsLimit: number;
  customersLimit: number;
}

export interface INotificationSettings {
  smsEnabled: boolean;
  callEnabled: boolean;
  reminderDaysThreshold: number;
  callTimeStart: string;
  callTimeEnd: string;
  maxRetriesPerCustomer: number;
  retryIntervalHours: number;
  minDueAmountForCall: number;
}

export interface IShopkeeperStats {
  totalCustomers: number;
  activeCustomers: number;
  totalDueAmount: number;
  totalCollected: number;
  totalCallsMade: number;
  successfulCalls: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, trim: true },
    area: { type: String, trim: true },
    thana: { type: String, trim: true },
    district: { type: String, trim: true },
    division: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false },
);

const BusinessHoursSchema = new Schema<IBusinessHours>(
  {
    open: { type: String, default: "09:00" },
    close: { type: String, default: "20:00" },
    closedDays: {
      type: [String],
      enum: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"],
      default: [],
    },
  },
  { _id: false },
);

const BankInfoSchema = new Schema<IBankInfo>(
  {
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    routingNumber: { type: String, trim: true },
  },
  { _id: false },
);

const MobilePaymentSchema = new Schema<IMobilePayment>(
  {
    bkash: { type: String, trim: true },
    nagad: { type: String, trim: true },
    rocket: { type: String, trim: true },
    upay: { type: String, trim: true },
  },
  { _id: false },
);

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { _id: false },
);

const SubscriptionSchema = new Schema<IShopkeeperSubscription>(
  {
    plan: {
      type: String,
      enum: ["free", "basic", "pro", "enterprise"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "trial"],
      default: "trial",
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    callsUsed: { type: Number, default: 0, min: 0 },
    callsLimit: { type: Number, default: 50 },
    customersLimit: { type: Number, default: 100 },
  },
  { _id: false },
);

const NotificationSettingsSchema = new Schema<INotificationSettings>(
  {
    smsEnabled: { type: Boolean, default: true },
    callEnabled: { type: Boolean, default: true },
    reminderDaysThreshold: { type: Number, default: 7 },
    callTimeStart: { type: String, default: "09:00" },
    callTimeEnd: { type: String, default: "20:00" },
    maxRetriesPerCustomer: { type: Number, default: 3 },
    retryIntervalHours: { type: Number, default: 6 },
    minDueAmountForCall: { type: Number, default: 100 },
  },
  { _id: false },
);

const StatsSchema = new Schema<IShopkeeperStats>(
  {
    totalCustomers: { type: Number, default: 0, min: 0 },
    activeCustomers: { type: Number, default: 0, min: 0 },
    totalDueAmount: { type: Number, default: 0, min: 0 },
    totalCollected: { type: Number, default: 0, min: 0 },
    totalCallsMade: { type: Number, default: 0, min: 0 },
    successfulCalls: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export type ShopkeeperStatus = "active" | "inactive" | "suspended";
export type ShopkeeperRole = "shopkeeper" | "admin";

export interface IShopkeeper extends Document {
  _id: Types.ObjectId;

  // Authentication fields
  email: string;
  phone: string;
  password: string;
  name: string;
  role: ShopkeeperRole;
  status: ShopkeeperStatus;
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshTokens: IRefreshToken[];
  lastLoginAt?: Date;
  lastLoginIP?: string;

  // Business profile fields
  shopName: string;
  shopType: string;
  tradeLicenseNo?: string;
  tinNo?: string;
  logo?: string;
  alternatePhone?: string;
  address: IAddress;
  businessHours: IBusinessHours;
  currency: string;
  bankInfo?: IBankInfo;
  mobilePayment?: IMobilePayment;

  // Subscription & settings
  subscription: IShopkeeperSubscription;
  notificationSettings: INotificationSettings;

  // Statistics
  stats: IShopkeeperStats;

  // Virtuals
  isSubscriptionActive: boolean;
  callSuccessRate: number;
  remainingCalls: number;
  subscriptionProgress: number;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
  canMakeCall(): boolean;
  incrementCallCount(): Promise<void>;
  updateStatsAfterCustomerChange(
    type: "add" | "remove" | "status_change",
    dueAmount?: number,
    oldStatus?: ShopkeeperStatus,
  ): Promise<void>;
  toJSON(): any;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

const ShopkeeperSchema = new Schema<IShopkeeper>(
  {
    // Authentication fields
    email: {
      type: String,
      required: [true, "ইমেইল আবশ্যক"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+$/, "বৈধ ইমেইল ঠিকানা দিন"],
    },
    phone: {
      type: String,
      required: [true, "ফোন নম্বর আবশ্যক"],
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^(?:\+8801|01)[3-9]\d{8}$/.test(v),
        message: "বৈধ বাংলাদেশি ফোন নম্বর দিন (01XXXXXXXXX)",
      },
    },
    password: {
      type: String,
      required: [true, "পাসওয়ার্ড আবশ্যক"],
      minlength: [6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "নাম আবশ্যক"],
      trim: true,
      maxlength: [50, "নাম ৫০ অক্ষরের বেশি হতে পারবে না"],
    },
    role: {
      type: String,
      enum: ["shopkeeper", "admin"],
      default: "shopkeeper",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshTokens: [RefreshTokenSchema],
    lastLoginAt: Date,
    lastLoginIP: String,

    // Business profile fields
    shopName: {
      type: String,
      required: [true, "দোকানের নাম আবশ্যক"],
      trim: true,
      maxlength: [100, "দোকানের নাম ১০০ অক্ষরের বেশি হতে পারবে না"],
    },
    shopType: {
      type: String,
      required: [true, "দোকানের ধরন আবশ্যক"],
      trim: true,
      default: "general",
    },
    tradeLicenseNo: {
      type: String,
      trim: true,
      sparse: true,
    },
    tinNo: {
      type: String,
      trim: true,
    },
    logo: String,
    alternatePhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^(?:\+8801|01)[3-9]\d{8}$/.test(v),
        message: "বৈধ বাংলাদেশি ফোন নম্বর দিন",
      },
    },
    address: { type: AddressSchema, default: () => ({}) },
    businessHours: { type: BusinessHoursSchema, default: () => ({}) },
    currency: { type: String, default: "BDT", uppercase: true, maxlength: 3 },
    bankInfo: { type: BankInfoSchema },
    mobilePayment: { type: MobilePaymentSchema, default: () => ({}) },

    // Subscription & settings
    subscription: { type: SubscriptionSchema, default: () => ({}) },
    notificationSettings: {
      type: NotificationSettingsSchema,
      default: () => ({}),
    },

    // Statistics
    stats: { type: StatsSchema, default: () => ({}) },
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

ShopkeeperSchema.index({ email: 1, status: 1 });
ShopkeeperSchema.index({ phone: 1, status: 1 });
ShopkeeperSchema.index({ "subscription.plan": 1, "subscription.status": 1 });
ShopkeeperSchema.index({ createdAt: -1 });
ShopkeeperSchema.index({ "address.district": 1 });
ShopkeeperSchema.index({
  status: 1,
  "subscription.status": 1,
  "subscription.callsUsed": 1,
});

// Compound index for common queries
ShopkeeperSchema.index({ status: 1, "subscription.status": 1, role: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

ShopkeeperSchema.virtual("isSubscriptionActive").get(function (
  this: IShopkeeper,
) {
  if (this.subscription.status === "cancelled") return false;

  if (this.subscription.status === "trial") {
    return this.subscription.trialEndsAt
      ? this.subscription.trialEndsAt > new Date()
      : true;
  }

  if (this.subscription.status === "active") {
    if (this.subscription.currentPeriodEnd) {
      return this.subscription.currentPeriodEnd > new Date();
    }
    return true;
  }

  return false;
});

ShopkeeperSchema.virtual("callSuccessRate").get(function (this: IShopkeeper) {
  if (!this.stats.totalCallsMade) return 0;
  return Number(
    ((this.stats.successfulCalls / this.stats.totalCallsMade) * 100).toFixed(2),
  );
});

ShopkeeperSchema.virtual("remainingCalls").get(function (this: IShopkeeper) {
  return Math.max(
    0,
    this.subscription.callsLimit - this.subscription.callsUsed,
  );
});

ShopkeeperSchema.virtual("subscriptionProgress").get(function (
  this: IShopkeeper,
) {
  if (this.subscription.callsLimit === 0) return 0;
  return Number(
    (
      (this.subscription.callsUsed / this.subscription.callsLimit) *
      100
    ).toFixed(2),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

ShopkeeperSchema.methods.comparePassword = async function (
  this: IShopkeeper,
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

ShopkeeperSchema.methods.generateAccessToken = function (
  this: IShopkeeper,
): string {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      shopName: this.shopName,
    },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m" } as jwt.SignOptions,
  );
};

ShopkeeperSchema.methods.generateRefreshToken = function (
  this: IShopkeeper,
): string {
  return jwt.sign(
    {
      id: this._id,
      version: this.refreshTokens.length,
    },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d" } as jwt.SignOptions,
  );
};

ShopkeeperSchema.methods.canMakeCall = function (this: IShopkeeper): boolean {
  return (
    this.status === "active" &&
    this.isSubscriptionActive &&
    this.remainingCalls > 0
  );
};

ShopkeeperSchema.methods.incrementCallCount = async function (
  this: IShopkeeper,
): Promise<void> {
  this.subscription.callsUsed += 1;
  this.stats.totalCallsMade += 1;
  await this.save();
};

ShopkeeperSchema.methods.updateStatsAfterCustomerChange = async function (
  this: IShopkeeper,
  type: "add" | "remove" | "status_change",
  dueAmount: number = 0,
  oldStatus?: ShopkeeperStatus,
): Promise<void> {
  switch (type) {
    case "add":
      this.stats.totalCustomers += 1;
      this.stats.activeCustomers += 1;
      this.stats.totalDueAmount += dueAmount;
      break;
    case "remove":
      this.stats.totalCustomers -= 1;
      if (oldStatus === "active") this.stats.activeCustomers -= 1;
      this.stats.totalDueAmount -= dueAmount;
      break;
    case "status_change":
      if (oldStatus === "active" && this.status !== "active") {
        this.stats.activeCustomers -= 1;
      } else if (oldStatus !== "active" && this.status === "active") {
        this.stats.activeCustomers += 1;
      }
      break;
  }

  // Ensure no negative values
  this.stats.totalCustomers = Math.max(0, this.stats.totalCustomers);
  this.stats.activeCustomers = Math.max(0, this.stats.activeCustomers);
  this.stats.totalDueAmount = Math.max(0, this.stats.totalDueAmount);

  await this.save();
};

// Remove sensitive data when converting to JSON
ShopkeeperSchema.methods.toJSON = function (this: IShopkeeper) {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.verificationToken;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

interface IShopkeeperModel extends Model<IShopkeeper> {
  findByEmail(email: string): Promise<IShopkeeper | null>;
  findByPhone(phone: string): Promise<IShopkeeper | null>;
  findActiveSubscribers(): Promise<IShopkeeper[]>;
  getDashboardStats(): Promise<any>;
}

ShopkeeperSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email }).select("+password");
};

ShopkeeperSchema.statics.findByPhone = function (phone: string) {
  return this.findOne({ phone }).select("+password");
};

ShopkeeperSchema.statics.findActiveSubscribers = function () {
  return this.find({
    status: "active",
    "subscription.status": { $in: ["active", "trial"] },
  });
};

ShopkeeperSchema.statics.getDashboardStats = async function () {
  const stats = await this.aggregate([
    {
      $facet: {
        totalCount: [{ $count: "count" }],
        activeCount: [{ $match: { status: "active" } }, { $count: "count" }],
        subscriptionStats: [
          {
            $group: {
              _id: "$subscription.plan",
              count: { $sum: 1 },
              totalCallsUsed: { $sum: "$subscription.callsUsed" },
              totalCallsLimit: { $sum: "$subscription.callsLimit" },
            },
          },
        ],
        totalRevenue: [
          {
            $group: {
              _id: null,
              total: { $sum: "$stats.totalCollected" },
            },
          },
        ],
      },
    },
  ]);

  return stats[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

ShopkeeperSchema.pre("save", async function () {
  // Hash password if modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Update subscription status based on dates
  if (
    this.subscription.trialEndsAt &&
    this.subscription.trialEndsAt < new Date()
  ) {
    if (this.subscription.status === "trial") {
      this.subscription.status = "expired";
    }
  }

  if (
    this.subscription.currentPeriodEnd &&
    this.subscription.currentPeriodEnd < new Date()
  ) {
    if (this.subscription.status === "active") {
      this.subscription.status = "expired";
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const Shopkeeper =
  (mongoose.models.Shopkeeper as IShopkeeperModel) ||
  mongoose.model<IShopkeeper, IShopkeeperModel>("Shopkeeper", ShopkeeperSchema);
