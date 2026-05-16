import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { env } from "../config/env";
import { socketManager } from "./socketManager";
import {
  socketAuthMiddleware,
  AuthenticatedSocket,
} from "./middleware/socketAuth.middleware";
import { registerMessageHandlers } from "./handlers/message.handler";
import {
  registerPresenceHandlers,
  notifyContactsOfPresence,
} from "./handlers/presence.handler";
import ConversationModel from "../models/Conversation.model";
import UserModel from "../models/User.model";

export const initSocketServer = (httpServer: HTTPServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.allowedOrigins,
      credentials: true,
    },
    // pingTimeout: how long to wait after a ping with no response before
    //              closing the connection. 60s is generous for mobile clients.
    // pingInterval: how often to send a ping. 25s keeps NAT connections alive.
    pingTimeout: 60_000,
    pingInterval: 25_000,
    // transports: prefer WebSocket, fall back to polling.
    // Polling is less efficient but works through corporate proxies/firewalls.
    transports: ["websocket", "polling"],
  });

  // ── Auth middleware ────────────────────────────────────────────────────────
  // Runs before the connection is established. Rejects unauthenticated clients.
  io.use(socketAuthMiddleware);

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on("connection", async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;

    console.log(
      `[socket] connected: userId=${authSocket.userId} socketId=${socket.id}`
    );

    // Register this socket in the user-socket map
    socketManager.addSocket(authSocket.userId, socket.id);

    // Update lastSeen to null (user is now active)
    await UserModel.findByIdAndUpdate(authSocket.userId, { lastSeen: null });

    // Auto-join all accepted conversation rooms on connect.
    // This means the user immediately starts receiving events for all their
    // conversations without needing to explicitly join each room.
    try {
      const conversations = await ConversationModel.find({
        members: authSocket.userId,
        status: "accepted",
      }).select("_id");

      const roomIds = conversations.map((c) => c._id.toString());
      if (roomIds.length > 0) {
        await socket.join(roomIds);
      }
    } catch (error) {
      console.error("[socket] failed to join rooms on connect:", error);
    }

    // Notify contacts that this user is now online
    await notifyContactsOfPresence(io, authSocket.userId, true);

    // ── Register event handlers ──────────────────────────────────────────────
    // We split handlers into files by concern (messages, presence) and
    // register them here. Each handler file receives io and socket and
    // attaches its own socket.on() listeners.
    registerMessageHandlers(io, authSocket);
    registerPresenceHandlers(io, authSocket);

    // ── Error handler ────────────────────────────────────────────────────────
    // Catches unhandled errors in socket event handlers.
    socket.on("error", (error) => {
      console.error(`[socket] error for userId=${authSocket.userId}:`, error);
    });
  });

  return io;
};