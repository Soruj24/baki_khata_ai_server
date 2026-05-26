import mongoose, { Document, Schema } from 'mongoose';
import type { ISubscriptionPlan } from '../types/billing.types.ts';

export interface SubscriptionPlanDocument extends Document, Omit<ISubscriptionPlan, 'id'> {
  id: string; // matches the schema definition
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    id: {
      type: String,
      required: [true, 'Plan ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Plan description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Plan price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'USD',
      uppercase: true,
      enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    },
    interval: {
      type: String,
      required: [true, 'Billing interval is required'],
      enum: ['month', 'year'],
      default: 'month',
    },
    features: {
      type: [String],
      required: [true, 'Plan features are required'],
      default: [],
      validate: {
        validator: function (features: string[]) {
          return features.length > 0;
        },
        message: 'At least one feature is required',
      },
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    storageLimit: {
      type: Number, // in MB
      required: true,
      default: 1024, // 1GB
      min: [0, 'Storage limit cannot be negative'],
    },
    apiCallLimit: {
      type: Number,
      required: true,
      default: 1000,
      min: [0, 'API call limit cannot be negative'],
    },
    teamMemberLimit: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'At least 1 team member is required'],
    },
    stripePriceId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    stripeProductId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    trialPeriodDays: {
      type: Number,
      default: 0,
      min: [0, 'Trial period cannot be negative'],
      max: [365, 'Trial period cannot exceed 365 days'],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        const json = ret as any;
        delete json._id;
        delete json.__v;
        delete json.createdAt;
        delete json.updatedAt;
        delete json.metadata;
        delete json.stripePriceId;
        delete json.stripeProductId;
        delete json.sortOrder;
        delete json.createdBy;
        return json;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        const json = ret as any;
        delete json._id;
        delete json.__v;
        delete json.createdAt;
        delete json.updatedAt;
        return json;
      },
    },
  }
);

// Virtual for formatted price
subscriptionPlanSchema.virtual('formattedPrice').get(function (this: SubscriptionPlanDocument) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency,
  }).format(this.price);
});

// Virtual for price per month (for annual plans)
subscriptionPlanSchema.virtual('monthlyPrice').get(function (this: SubscriptionPlanDocument) {
  if (this.interval === 'year') {
    return this.price / 12;
  }
  return this.price;
});

// Indexes
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });
subscriptionPlanSchema.index({ price: 1 });
subscriptionPlanSchema.index({ stripePriceId: 1 }, { unique: true, sparse: true });
subscriptionPlanSchema.index({ stripeProductId: 1 }, { unique: true, sparse: true });

// Pre-save hook to ensure id is set
subscriptionPlanSchema.pre('save', function () {
  if (!this.id) {
    this.id = this._id.toString();
  }
});

const SubscriptionPlan = mongoose.model<SubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);

export default SubscriptionPlan;