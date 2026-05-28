import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshToken,
  getCurrentShopkeeper,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/authController.ts";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const authRouter = Router();

import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  changePasswordValidation,
} from "../validator/userValidator.ts";
import { runValidation } from "../validator/index.ts";
import { resendOTP, sendOTP, verifyOTP } from "../controllers/otpController.ts";


authRouter.post("/send-otp", sendOTP);
authRouter.post("/verify-otp", verifyOTP);
authRouter.post("/resend-otp", resendOTP);

// Public routes with rate limiting
authRouter.post(
  "/register",
  registerLimiter,
  registerValidation,
  runValidation,
  register,
);
authRouter.post(
  "/login",
  loginLimiter,
  loginValidation,
  runValidation,
  login,
);
authRouter.post("/logout", logout);
authRouter.post("/refresh-token", refreshToken);
authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordValidation,
  runValidation,
  forgotPassword,
);
authRouter.post(
  "/reset-password",
  resetPasswordValidation,
  validateRequest,
  resetPassword,
);
authRouter.post(
  "/verify-email",
  verifyEmailValidation,
  runValidation,
  verifyEmail,
);
authRouter.post(
  "/resend-verification",
  resendVerificationValidation,
  runValidation,
  resendVerificationEmail,
);

// Protected routes (require authentication)
authRouter.get("/me", authenticate, getCurrentShopkeeper);
authRouter.post(
  "/change-password",
  authenticate,
  changePasswordValidation,
  runValidation,
  changePassword,
);

export default authRouter;
