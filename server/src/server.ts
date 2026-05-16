import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { initSocketServer } from "./socket";
import { socketManager } from "./socket/socketManager";
import "./config/redis";

const startServer = async (): Promise<void> => {
  await connectDB();

  // Socket.IO must attach to the raw HTTP server, not the Express app.
  // Express app.listen() creates an HTTP server internally — we need to create
  // it explicitly so we can pass the same server to both Express and Socket.IO.
  // If Socket.IO attaches to a different server, it runs on a different port
  // and the client can't connect through the same origin.
  const httpServer = http.createServer(app);

  // Initialize Socket.IO and register it in socketManager so controllers
  // can emit events without importing io directly.
  const io = initSocketServer(httpServer);
  socketManager.setIO(io);

  httpServer.listen(env.port, () => {
    console.log(`\n🚀 Neurova server running`);
    console.log(`   Port     : ${env.port}`);
    console.log(`   Env      : ${env.nodeEnv}`);
    console.log(`   API base : http://localhost:${env.port}/api/v1`);
    console.log(`   Socket   : ws://localhost:${env.port}\n`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);

    // Close Socket.IO first — stops accepting new connections
    io.close(() => console.log("✅ Socket.IO closed"));

    httpServer.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("💥 Unhandled Promise Rejection:", reason);
    shutdown("unhandledRejection");
  });
};

startServer();