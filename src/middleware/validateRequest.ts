import { type Request, type Response, type NextFunction } from "express";
import { validationResult } from "express-validator";
import { errorResponse } from "../controllers/responsControllers.js";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, {
      statusCode: 400,
      message: errors.array()[0]?.msg || "Validation failed",
    });
  }
  next();
};