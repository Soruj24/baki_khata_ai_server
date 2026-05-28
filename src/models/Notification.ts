import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId | string;
  title: string;
  message: string;
  type: string;
  category?: string;
  priority?: string;
  read: boolean;
  readAt?: Date;
  sentAt: Date;
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "info" },
    category: { type: String },
    priority: { type: String, default: "medium" },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    sentAt: { type: Date, default: Date.now },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, sentAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
