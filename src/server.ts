import http from "http";
import { Server } from "socket.io";
import app from "./app.js";

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const server = http.createServer(app);

//  Socket.IO initialization
export const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// সকেট কানেকশন হ্যান্ডেলিং
io.on("connection", (socket) => {
  console.log(`🔗 New Socket Connected: ${socket.id}`);

  //  Join a personal room for notifications
  socket.on("join", (userId: string) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User joined room: ${userId}`);
    }
  });

  socket.on("error", (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket Disconnected: ${socket.id}`);
  });
});

//  Database connection function
const connectDatabase = async () => {
  console.log("💾 Database connection initialized...");
  // return mongoose.connect(process.env.MONGO_URI!);
};

//  Server startup function
const startServer = async () => {
  try {
    await connectDatabase();
    server.listen(PORT, () => {
      console.log(
        `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error(
      "❌ Server startup failed due to database connection error:",
      error,
    );
    process.exit(1);
  }
};

startServer();
