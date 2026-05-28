import { Router } from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getOverdueCustomers,
  getCallQueue,
  getCustomerStatsSummary,
} from "../controllers/customerController.js";
import { authenticate } from "../middleware/auth.ts";

const shopkeeperRouter = Router();

// All customer routes require authentication
shopkeeperRouter.use(authenticate);

// Customer CRUD routes
shopkeeperRouter.post("/", createCustomer);
shopkeeperRouter.get("/", getCustomers);
shopkeeperRouter.get("/stats/summary", getCustomerStatsSummary);
shopkeeperRouter.get("/overdue", getOverdueCustomers);
shopkeeperRouter.get("/call-queue", getCallQueue);
shopkeeperRouter.get("/:id", getCustomerById);
shopkeeperRouter.put("/:id", updateCustomer);
shopkeeperRouter.delete("/:id", deleteCustomer);

export default shopkeeperRouter;
