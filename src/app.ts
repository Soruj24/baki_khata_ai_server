import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import createError, { HttpError } from "http-errors";

//  Environment variables
const NODE_ENV = process.env.NODE_ENV || "development";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();

app.use(cookieParser());

//  Personal CORS configuration
const allowedOrigins = [CLIENT_URL, "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      //  Allow localhost requests in development mode
      if (
        NODE_ENV !== "production" &&
        (origin.includes("localhost") || origin.includes("127.0.0.1"))
      ) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        return (
          origin === allowedOrigin ||
          origin === allowedOrigin.replace(/\/$/, "")
        );
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS Blocked: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 204,
  }),
);

//  Reverse Proxy (Nginx/Heroku/Render) setup
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

//  Helmet security middleware
app.use(
  helmet({
    ...(NODE_ENV !== "production" && { contentSecurityPolicy: false }),
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

//  NoSQL injection protection middleware
app.use(mongoSanitize());

//  HTTP Parameter Pollution protection middleware
app.use(hpp());

//  Rate Limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === "production" ? 100 : 1000,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: NODE_ENV === "production" ? 20 : 100,
  message: {
    error: "Too many authentication attempts, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//  Route-specific rate limiting middleware
app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

//  Health Check middleware
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

//  API Routes middleware
// app.use("/api/auth", authRouter);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Server is running", environment: NODE_ENV });
});

//  Global Error Handler middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404, `Route ${req.originalUrl} not found`));
});

//  Global Error Handler middleware
const errorHandler: ErrorRequestHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err.status || err.statusCode || 500;
  const isDevelopment = NODE_ENV === "development";

  if (NODE_ENV !== "test") {
    console.error(`❌ Error ${statusCode}: ${err.message}`);
    if (isDevelopment) console.error(err.stack);
  }

  //  Response format
  res.status(statusCode).json({
    success: false,
    statusCode,
    message:
      statusCode === 500 && !isDevelopment
        ? "Internal Server Error"
        : err.message,
    ...(isDevelopment && { stack: err.stack }),
  });
};

app.use(errorHandler);

export default app;
