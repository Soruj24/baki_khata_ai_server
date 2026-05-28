import bcrypt from "bcryptjs";
import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import {
  clearAllRefreshTokens,
  clearAuthCookies,
  generateTokens,
  removeRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  storeRefreshToken,
} from "../helper/cookie.ts";
import { Shopkeeper } from "../models/Shopkeeper.js";
import type { AuthRequest } from "../types/index.ts";
import { errorResponse, successResponse } from "./responsControllers.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../helper/email.ts";

/**
 * @desc    Register new shopkeeper
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, shopName } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return errorResponse(res, {
        statusCode: 400,
        message: "নাম, ইমেইল, ফোন নম্বর এবং পাসওয়ার্ড আবশ্যক।",
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new shopkeeper
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const shopkeeper = new Shopkeeper({
      name,
      email,
      phone,
      password: hashedPassword,
      shopName: shopName || name,
      verificationToken,
      verificationTokenExpires,
      subscription: {
        plan: "free",
        status: "trial",
        callsLimit: 50,
        customersLimit: 100,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await shopkeeper.save();

    // Send welcome email
    await sendWelcomeEmail(email, name);

    // Send verification email
    await sendVerificationEmail(email, name, verificationToken);

    return successResponse(res, {
      statusCode: 201,
      message: "রেজিস্ট্রেশন সফল হয়েছে। অনুগ্রহ করে আপনার ইমেইল ভেরিফাই করুন।",
      payload: {
        userId: shopkeeper._id,
        email: shopkeeper.email,
        name: shopkeeper.name,
        shopName: shopkeeper.shopName,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error?.name === "ValidationError" && error?.errors) {
      const messages = Object.values(error.errors)
        .map((e: any) => e.message)
        .join(", ");
      return errorResponse(res, {
        statusCode: 400,
        message: messages,
      });
    }
    if (error?.code === 11000) {
      return errorResponse(res, {
        statusCode: 409,
        message: "এই ইমেইল বা ফোন নম্বর ইতিমধ্যে ব্যবহৃত হচ্ছে।",
      });
    }
    return errorResponse(res, {
      message: "রেজিস্ট্রেশন ব্যর্থ হয়েছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Login shopkeeper
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, {
        statusCode: 400,
        message: "ইমেইল এবং পাসওয়ার্ড আবশ্যক।",
      });
    }

    // Find user by email with password field
    const user = await Shopkeeper.findOne({ email }).select("+password");

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: "ইমেইল বা পাসওয়ার্ড ভুল।",
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return errorResponse(res, {
        statusCode: 403,
        message: "অনুগ্রহ করে প্রথমে আপনার ইমেইল ভেরিফাই করুন।",
      });
    }

    // Check if account is active
    if (user.status !== "active") {
      return errorResponse(res, {
        statusCode: 403,
        message: "আপনার অ্যাকাউন্ট সক্রিয় নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, {
        statusCode: 401,
        message: "ইমেইল বা পাসওয়ার্ড ভুল।",
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip || "";
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Store refresh token with device info
    await storeRefreshToken(
      user._id.toString(),
      refreshToken,
      req.headers["user-agent"],
      req.ip,
    );

    // Set cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    // Remove sensitive data
    const userData = user.toJSON();
    delete (userData as Record<string, any>).password;

    return successResponse(res, {
      message: "লগইন সফল হয়েছে।",
      payload: {
        accessToken,
        user: userData,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(res, {
      message: "লগইন ব্যর্থ হয়েছে। পরে আবার চেষ্টা করুন।",
    });
  }
};

/**
 * @desc    Logout shopkeeper
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET as string,
        ) as any;

        await removeRefreshToken(decoded.userId, refreshToken);
      } catch (error) {
        // Token might be expired or invalid, just clear cookie
      }
    }

    // Clear cookies
    clearAuthCookies(res);

    return successResponse(res, {
      message: "লগআউট সফল হয়েছে।",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return errorResponse(res, {
      message: "লগআউট ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return errorResponse(res, {
        statusCode: 401,
        message: "রিফ্রেশ টোকেন পাওয়া যায়নি।",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string,
    ) as any;

    // Find user with this refresh token
    const user = await Shopkeeper.findOne({
      _id: decoded.userId,
      "refreshTokens.token": refreshToken,
    });

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অবৈধ রিফ্রেশ টোকেন।",
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id.toString(),
    );

    // Remove old refresh token and add new one
    await removeRefreshToken(user._id.toString(), refreshToken);
    await storeRefreshToken(
      user._id.toString(),
      newRefreshToken,
      req.headers["user-agent"],
      req.ip,
    );

    // Set new tokens in cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return successResponse(res, {
      payload: { accessToken },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return errorResponse(res, {
      statusCode: 401,
      message: "রিফ্রেশ টোকেন মেয়াদ শেষ বা অবৈধ।",
    });
  }
};

/**
 * @desc    Get current shopkeeper info
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getCurrentShopkeeper = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const user = await Shopkeeper.findById(userId).select(
      "-password -refreshTokens -verificationToken -resetPasswordToken -resetPasswordExpires",
    );

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: "ব্যবহারকারী পাওয়া যায়নি।",
      });
    }

    return successResponse(res, {
      payload: { user },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return errorResponse(res, {
      message: "ব্যবহারকারীর তথ্য আনতে ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 * @access  Private
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body as Record<string, any>;

    const user = await Shopkeeper.findById(userId).select("+password");

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: "ব্যবহারকারী পাওয়া যায়নি।",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return errorResponse(res, {
        statusCode: 401,
        message: "বর্তমান পাসওয়ার্ড ভুল।",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    // Clear all refresh tokens (force re-login)
    await clearAllRefreshTokens(userId as string);
    await user.save();

    // Clear cookies
    clearAuthCookies(res);

    return successResponse(res, {
      message:
        "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse(res, {
      message: "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Forgot password - send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await Shopkeeper.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return successResponse(res, {
        message:
          "যদি এই ইমেইলটি নিবন্ধিত হয়, তাহলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।",
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_RESET_SECRET as string,
      { expiresIn: "1h" },
    );

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // TODO: Send reset password email
    // await sendResetPasswordEmail(email, resetToken);

    return successResponse(res, {
      message:
        "যদি এই ইমেইলটি নিবন্ধিত হয়, তাহলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse(res, {
      message: "পাসওয়ার্ড রিসেট ইমেইল পাঠাতে ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_RESET_SECRET as string,
    ) as any;

    const user = await Shopkeeper.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return errorResponse(res, {
        statusCode: 400,
        message: "পাসওয়ার্ড রিসেট লিংকটি মেয়াদ শেষ বা অবৈধ।",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined as unknown as string;
    user.resetPasswordExpires = undefined as unknown as Date;

    // Clear all refresh tokens
    await clearAllRefreshTokens(user._id.toString());
    await user.save();

    // Clear cookies
    clearAuthCookies(res);

    return successResponse(res, {
      message:
        "পাসওয়ার্ড সফলভাবে রিসেট করা হয়েছে। অনুগ্রহ করে নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(res, {
      message: "পাসওয়ার্ড রিসেট করতে ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Verify email
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(
      token,
      process.env.JWT_VERIFICATION_SECRET as string,
    ) as any;

    const user = await Shopkeeper.findOne({
      email: decoded.email,
      verificationToken: token,
    });

    if (!user) {
      return errorResponse(res, {
        statusCode: 400,
        message: "ভেরিফিকেশন লিংকটি অবৈধ বা মেয়াদ শেষ।",
      });
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined as unknown as string;
    await user.save();


    await sendWelcomeEmail(user.email, user.name);

    return successResponse(res, {
      message: "ইমেইল সফলভাবে ভেরিফাই করা হয়েছে। এখন আপনি লগইন করতে পারবেন।",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return errorResponse(res, {
      message: "ইমেইল ভেরিফিকেশন ব্যর্থ হয়েছে।",
    });
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await Shopkeeper.findOne({ email });
    if (!user) {
      return successResponse(res, {
        message:
          "যদি এই ইমেইলটি নিবন্ধিত হয়, তাহলে ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।",
      });
    }

    if (user.isEmailVerified) {
      return errorResponse(res, {
        statusCode: 400,
        message: "এই ইমেইলটি ইতিমধ্যে ভেরিফাই করা হয়েছে।",
      });
    }

    // Generate new 6-digit OTP
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    // Send verification email
    try {
      const { sendVerificationEmail } = await import("../helper/email.ts");
      await sendVerificationEmail(email, user.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to resend verification email:", emailError);
    }

    return successResponse(res, {
      message:
        "ভেরিফিকেশন ইমেইল পুনরায় পাঠানো হয়েছে। অনুগ্রহ করে আপনার ইমেইল চেক করুন।",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return errorResponse(res, {
      message: "ভেরিফিকেশন ইমেইল পাঠাতে ব্যর্থ হয়েছে।",
    });
  }
};


