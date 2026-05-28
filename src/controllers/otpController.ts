import { type Request, type Response } from "express";
import crypto from "crypto";
import { errorResponse, successResponse } from "./responsControllers.js";
import { Shopkeeper } from "../models/Shopkeeper.js";

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map<
  string,
  {
    otp: string;
    expiresAt: Date;
    name: string;
    email: string;
    phone: string;
    password: string;
    shopName?: string;
  }
>();

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via SMS (using a service like Twilio, Vonage, etc.)
const sendOTPSMS = async (phone: string, otp: string): Promise<boolean> => {
  // TODO: Integrate with SMS provider
  console.log(`Sending OTP ${otp} to ${phone}`);

  // For development, just log
  // In production, use:
  // - Twilio
  // - Vonage (Nexmo)
  // - BD SMS Gateway (like Banglalink, Robi, etc.)

  return true;
};

// Send OTP via Email
const sendOTPEmail = async (
  email: string,
  otp: string,
  name: string,
): Promise<boolean> => {
  // TODO: Integrate with email service (Nodemailer, SendGrid, etc.)
  console.log(`Sending OTP ${otp} to ${email}`);

  // For development, just log
  // In production, use:
  // - Nodemailer
  // - SendGrid
  // - AWS SES

  return true;
};

/**
 * @desc    Send OTP for phone verification
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { phone, email, name, password, shopName } = req.body;

    if (!phone && !email) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Phone or email is required",
      });
    }

    // Check if user already exists
    const existingUser = await Shopkeeper.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ইমেইল বা ফোন নম্বর ইতিমধ্যে ব্যবহৃত হচ্ছে।",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store registration data temporarily
    const tempKey = phone || email;
    otpStore.set(tempKey, {
      otp,
      expiresAt,
      name,
      email,
      phone,
      password,
      shopName,
    });

    // Send OTP via SMS if phone provided
    if (phone) {
      await sendOTPSMS(phone, otp);
    }

    // Send OTP via email if email provided
    if (email) {
      await sendOTPEmail(email, otp, name);
    }

    // Auto-cleanup after 10 minutes
    setTimeout(
      () => {
        otpStore.delete(tempKey);
      },
      10 * 60 * 1000,
    );

    return successResponse(res, {
      message: "OTP পাঠানো হয়েছে। অনুগ্রহ করে আপনার ফোন/ইমেইল চেক করুন।",
      payload: {
        tempKey,
        expiresIn: 600, // 10 minutes in seconds
      },
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return errorResponse(res, {
      message: "OTP পাঠাতে ব্যর্থ হয়েছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Verify OTP and complete registration
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { tempKey, otp } = req.body;

    if (!tempKey || !otp) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Temp key and OTP are required",
      });
    }

    const registrationData = otpStore.get(tempKey);

    if (!registrationData) {
      return errorResponse(res, {
        statusCode: 400,
        message: "OTP মেয়াদ শেষ বা অবৈধ। অনুগ্রহ করে পুনরায় চেষ্টা করুন।",
      });
    }

    if (registrationData.otp !== otp) {
      return errorResponse(res, {
        statusCode: 400,
        message: "ভুল OTP। অনুগ্রহ করে সঠিক OTP দিন।",
      });
    }

    if (new Date() > registrationData.expiresAt) {
      otpStore.delete(tempKey);
      return errorResponse(res, {
        statusCode: 400,
        message: "OTP মেয়াদ শেষ। অনুগ্রহ করে পুনরায় OTP পাঠান।",
      });
    }

    // Check again if user exists (in case of duplicate registration during OTP process)
    const existingUser = await Shopkeeper.findOne({
      $or: [
        { email: registrationData.email },
        { phone: registrationData.phone },
      ],
    });

    if (existingUser) {
      otpStore.delete(tempKey);
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ইমেইল বা ফোন নম্বর ইতিমধ্যে ব্যবহৃত হচ্ছে।",
      });
    }

    // Hash password
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(registrationData.password, 12);

    // Create verification token
    const jwt = await import("jsonwebtoken");
    const verificationToken = jwt.sign(
      { email: registrationData.email },
      process.env.JWT_VERIFICATION_SECRET as string,
      { expiresIn: "24h" },
    );

    // Create new shopkeeper
    const shopkeeper = new Shopkeeper({
      name: registrationData.name,
      email: registrationData.email,
      phone: registrationData.phone,
      password: hashedPassword,
      shopName: registrationData.shopName || registrationData.name,
      verificationToken,
      isEmailVerified: true, // Phone verified, email will be verified later
      subscription: {
        plan: "free",
        status: "active",
        callsLimit: 50,
        customersLimit: 100,
      },
    });

    await shopkeeper.save();

    // Clean up OTP store
    otpStore.delete(tempKey);

    // TODO: Send welcome email/SMS

    return successResponse(res, {
      statusCode: 201,
      message: "রেজিস্ট্রেশন সফল হয়েছে!",
      payload: {
        userId: shopkeeper._id,
        email: shopkeeper.email,
        name: shopkeeper.name,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return errorResponse(res, {
      message: "রেজিস্ট্রেশন ব্যর্থ হয়েছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Resend OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { tempKey } = req.body;

    if (!tempKey) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Temp key is required",
      });
    }

    const registrationData = otpStore.get(tempKey);

    if (!registrationData) {
      return errorResponse(res, {
        statusCode: 400,
        message: "সেশন মেয়াদ শেষ। অনুগ্রহ করে পুনরায় নিবন্ধন করুন।",
      });
    }

    // Generate new OTP
    const newOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    registrationData.otp = newOTP;
    registrationData.expiresAt = expiresAt;
    otpStore.set(tempKey, registrationData);

    // Resend OTP
    if (registrationData.phone) {
      await sendOTPSMS(registrationData.phone, newOTP);
    }
    if (registrationData.email) {
      await sendOTPEmail(registrationData.email, newOTP, registrationData.name);
    }

    return successResponse(res, {
      message: "OTP পুনরায় পাঠানো হয়েছে।",
      payload: {
        expiresIn: 600,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return errorResponse(res, {
      message: "OTP পুনরায় পাঠাতে ব্যর্থ হয়েছে।",
    });
  }
};
