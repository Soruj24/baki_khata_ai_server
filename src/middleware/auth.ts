import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorResponse } from "../controllers/responsControllers.js";

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace("Bearer ", "");
    }

    if (!token) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অনুগ্রহ করে লগইন করুন।",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    req.userId = decoded.userId;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return errorResponse(res, {
        statusCode: 401,
        message: "টোকেন মেয়াদ শেষ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse(res, {
        statusCode: 401,
        message: "অবৈধ টোকেন। অনুগ্রহ করে পুনরায় লগইন করুন।",
      });
    }

    return errorResponse(res, {
      statusCode: 401,
      message: "প্রমাণীকরণ ব্যর্থ হয়েছে।",
    });
  }
};
