import { type Response } from "express";
import jwt from "jsonwebtoken";
import { Shopkeeper } from "../models/Shopkeeper.ts";

/**
 * Set access token cookie
 */
export const setAccessTokenCookie = (res: Response, accessToken: string) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
  });
};

/**
 * Set refresh token cookie
 */
export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
};

/**
 * Clear all auth cookies
 */
export const clearAuthCookies = (res: Response) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
};

/**
 * Get browser name from user agent
 */
export const getBrowser = (userAgent: string): string => {
  if (!userAgent) return "Unknown";

  const ua = userAgent.toLowerCase();

  if (ua.includes("chrome") && !ua.includes("edg")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("edg")) return "Edge";
  if (ua.includes("opera") || ua.includes("opr")) return "Opera";
  if (ua.includes("brave")) return "Brave";

  return "Unknown";
};

/**
 * Get operating system from user agent
 */
export const getOS = (userAgent: string): string => {
  if (!userAgent) return "Unknown";

  const ua = userAgent.toLowerCase();

  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macos")) return "macOS";
  if (ua.includes("linux") && !ua.includes("android")) return "Linux";
  if (ua.includes("android")) return "Android";
  if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad"))
    return "iOS";

  return "Unknown";
};

/**
 * Get device type from user agent
 */
export const getDevice = (userAgent: string): string => {
  if (!userAgent) return "Desktop";

  const ua = userAgent.toLowerCase();

  if (ua.includes("mobile") && !ua.includes("ipad") && !ua.includes("tablet")) {
    return "Mobile";
  }
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "Tablet";
  }

  return "Desktop";
};

/**
 * Get platform (alias for getDevice)
 */
export const getPlatform = (userAgent: string): string => {
  return getDevice(userAgent);
};

/**
 * Get detailed device info
 */
export const getDeviceInfo = (userAgent: string) => {
  return {
    browser: getBrowser(userAgent),
    os: getOS(userAgent),
    device: getDevice(userAgent),
    userAgent: userAgent || "Unknown",
  };
};

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId, type: "access" },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m" } as jwt.SignOptions,
  );

  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d" } as jwt.SignOptions,
  );

  return { accessToken, refreshToken };
};
// Store refresh token in database with device info
export const storeRefreshToken = async (
  userId: string,
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string,
) => {
  await Shopkeeper.findByIdAndUpdate(userId, {
    $push: {
      refreshTokens: {
        token: refreshToken,
        createdAt: new Date(),
        userAgent: userAgent || "Unknown",
        ipAddress: ipAddress || "Unknown",
        browser: getBrowser(userAgent || ""),
        os: getOS(userAgent || ""),
        device: getDevice(userAgent || ""),
      },
    },
  });
};

// Remove refresh token from database
export const removeRefreshToken = async (
  userId: string,
  refreshToken: string,
) => {
  await Shopkeeper.findByIdAndUpdate(userId, {
    $pull: {
      refreshTokens: { token: refreshToken },
    },
  });
};

// Clear all refresh tokens
export const clearAllRefreshTokens = async (userId: string) => {
  await Shopkeeper.findByIdAndUpdate(userId, {
    $set: { refreshTokens: [] },
  });
};
