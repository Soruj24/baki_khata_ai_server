import { type Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import createError from "http-errors";
import speakeasy from "speakeasy";
import { hashPassword } from "../helper/hashPassword.ts";
import { createJSONWebToken } from "../helper/jsonwebtoken.ts";
import type { CreateUserBody } from "../types/index.ts";
import { jwtAccessKey, jwtRefreshKey } from "../secret.ts";
import { AUTH_CONSTANTS } from "../Constants/index.ts";
import User from "../models/schemas/User.ts";
import Session from "../models/Session.ts";
import type { IUser } from "../models/interfaces/IUser.ts";

export const createUser = async (userData: CreateUserBody) => {
    try {
        
        const hashedPassword = await hashPassword(userData.password);
        const newUser = {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            password: hashedPassword,
            gender: userData.gender,
            ...(userData.dateOfBirth ? { dateOfBirth: new Date(userData.dateOfBirth) } : {}),
            addresses: userData.addresses,
            preferences: userData.preferences,
            role: 'user',
            isEmailVerified: false,
            status: 'pending',
            avatar: { url: '', publicId: '' },
        };

        const savedUser = await User.create(newUser as any);



        const user = savedUser.toObject();
        return user;
    } catch (error) {
        throw new Error("Error creating user");
    }
};

export const getClientIP = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "0.0.0.0"
  );
};

export const sanitizeUser = (user: Record<string, any>): Record<string, any> => {
  if (typeof user?.toObject === "function") {
    return user.toObject();
  }
  const sanitized = { ...user };
  const sensitiveFields: string[] = [
    "password",
    "refreshToken",
    "resetPasswordToken",
    "resetPasswordExpires",
    "emailVerificationToken",
    "emailVerificationExpires",
    "loginAttempts",
    "lockoutUntil",
    "__v",
    "twoFactorAuth",
    "auditLog",
  ];
  for (const field of sensitiveFields) {
    delete sanitized[field];
  }
  return sanitized;
};

export const checkAccountLockout = (user: IUser): void => {
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    throw createError(429, "Account is temporarily locked. Please try again later.");
  }
};

export const validateUserStatus = (user: IUser): void => {
  if (user.status === "suspended" || user.status === "deleted") {
    throw createError(403, `Account is ${user.status}. Please contact support.`);
  }
  if (user.isBanned) {
    throw createError(403, "Your account has been suspended.");
  }
  if (!user.isActive) {
    throw createError(403, "Account is not active. Please verify your email.");
  }
};

export const trackFailedLoginAttempt = async (user: any): Promise<void> => {
  user.loginAttempts = (user.loginAttempts || 0) + 1;
  if (user.loginAttempts >= 5) {
    user.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  if (typeof user.save === "function") {
    await user.save();
  }
};

export const resetLoginAttempts = async (user: any): Promise<void> => {
  user.loginAttempts = 0;
  user.lockoutUntil = undefined;
  if (typeof user.save === "function") {
    await user.save();
  }
};

export const verifyTwoFactorCode = async (
  user: IUser,
  code: string,
): Promise<{ isValid: boolean; isBackupCode: boolean }> => {
  const twoFactorAuth = (user as any).twoFactorAuth;
  if (!twoFactorAuth?.secret) {
    return { isValid: false, isBackupCode: false };
  }

  const isValid = speakeasy.totp.verify({
    secret: twoFactorAuth.secret,
    encoding: "base32",
    token: code,
    window: 2,
  });

  if (isValid) {
    return { isValid: true, isBackupCode: false };
  }

  if (twoFactorAuth.backupCodes) {
    for (let i = 0; i < twoFactorAuth.backupCodes.length; i++) {
      const match = await bcrypt.compare(code, twoFactorAuth.backupCodes[i]);
      if (match) {
        twoFactorAuth.backupCodes.splice(i, 1);
        if (typeof (user as any).save === "function") {
          await (user as any).save();
        }
        return { isValid: true, isBackupCode: true };
      }
    }
  }

  return { isValid: false, isBackupCode: false };
};

export const generateAuthTokens = (
  user: IUser,
): { accessToken: string; refreshToken: string } => {
  const payload: Record<string, any> = {
    id: (user as any)._id?.toString() || (user as any).id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createJSONWebToken(
    payload,
    jwtAccessKey,
    AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY,
  );
  const refreshToken = createJSONWebToken(
    payload,
    jwtRefreshKey,
    AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY,
  );

  return { accessToken, refreshToken };
};

export const createSession = async (
  userId: string,
  tokens: { accessToken: string; refreshToken: string },
  req: Request,
): Promise<any> => {
  const userAgent = req.get("User-Agent");
  const ipAddress = getClientIP(req);

  const session = await Session.create({
    userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userAgent: userAgent || "Unknown",
    ipAddress,
    deviceInfo: /Mobile|Android|iPhone|iPad/.test(userAgent || "")
      ? "Mobile"
      : /Tablet/.test(userAgent || "")
        ? "Tablet"
        : "Desktop",
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return session;
};

export const updateLoginHistory = async (user: any, req: Request): Promise<void> => {
  const ipAddress = getClientIP(req);
  const userAgent = req.get("User-Agent");

  if (typeof user.addLoginHistory === "function") {
    await user.addLoginHistory({
      ipAddress,
      userAgent: userAgent || "Unknown",
      timestamp: new Date(),
      success: true,
      loginMethod: "password",
    });
  }
};
