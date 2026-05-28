import rateLimit from "express-rate-limit";
import { body } from "express-validator";

// Rate limiters for auth routes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message:
      "অনেকবার লগইন চেষ্টা করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পরে চেষ্টা করুন।",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message:
      "অনেকবার রেজিস্ট্রেশন চেষ্টা করা হয়েছে। অনুগ্রহ করে ১ ঘন্টা পরে চেষ্টা করুন।",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message:
      "অনেকবার পাসওয়ার্ড রিসেট চেষ্টা করা হয়েছে। অনুগ্রহ করে ১ ঘন্টা পরে চেষ্টা করুন।",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules
export const registerValidation = [
  body("name")
    .notEmpty()
    .withMessage("নাম প্রয়োজন")
    .isLength({ min: 2, max: 50 })
    .withMessage("নাম ২ থেকে ৫০ অক্ষরের মধ্যে হতে হবে")
    .trim()
    .escape(),
  body("email")
    .notEmpty()
    .withMessage("ইমেইল ঠিকানা প্রয়োজন")
    .matches(/^\S+@\S+$/)
    .withMessage("বৈধ ইমেইল ঠিকানা দিন")
    .normalizeEmail()
    .trim()
    .toLowerCase(),
  body("phone")
    .notEmpty()
    .withMessage("ফোন নম্বর প্রয়োজন")
    .matches(/^(?:\+8801|01)[3-9]\d{8}$/)
    .withMessage("বৈধ বাংলাদেশি ফোন নম্বর দিন (01XXXXXXXXX)")
    .trim(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("পাসওয়ার্ডে অন্তত একটি অক্ষর এবং একটি সংখ্যা থাকতে必須")
    .trim(),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("পাসওয়ার্ড মিলছে না"),
  body("shopName")
    .optional()
    .isLength({ max: 100 })
    .withMessage("দোকানের নাম ১০০ অক্ষরের বেশি হতে পারবে না")
    .trim()
    .escape(),
];

export const loginValidation = [
  body("email")
    .matches(/^\S+@\S+$/)
    .withMessage("বৈধ ইমেইল ঠিকানা দিন")
    .normalizeEmail()
    .trim(),
];

export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("বর্তমান পাসওয়ার্ড প্রয়োজন")
    .trim(),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("পাসওয়ার্ডে অন্তত একটি অক্ষর এবং একটি সংখ্যা থাকতে হবে")
    .trim(),
  body("confirmNewPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("পাসওয়ার্ড মিলছে না"),
];

export const forgotPasswordValidation = [
  body("email")
    .matches(/^\S+@\S+$/)
    .withMessage("বৈধ ইমেইল ঠিকানা দিন")
    .normalizeEmail()
    .trim(),
];

export const resetPasswordValidation = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage("পাসওয়ার্ডে অন্তত একটি অক্ষর এবং একটি সংখ্যা থাকতে হবে")
    .trim(),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("পাসওয়ার্ড মিলছে না"),
];

export const verifyEmailValidation = [
  body("token").notEmpty().withMessage("ভেরিফিকেশন কোড প্রয়োজন").trim(),
  body("email")
    .matches(/^\S+@\S+$/)
    .withMessage("বৈধ ইমেইল ঠিকানা দিন")
    .normalizeEmail()
    .trim(),
];

export const resendVerificationValidation = [
  body("email")
    .matches(/^\S+@\S+$/)
    .withMessage("বৈধ ইমেইল ঠিকানা দিন")
    .normalizeEmail()
    .trim(),
];
