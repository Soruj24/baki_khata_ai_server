import mongoose from "mongoose";
import { mongoUri } from "../secret.ts";

export const connectDatabase = async (): Promise<void> => {
  try {

      await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB Connected `);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};
