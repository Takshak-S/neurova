import { Server } from "socket.io";

// The user-socket map is the single most important data structure in
// the real-time layer. It answers the question:
// "Given a userId, which socket IDs are currently connected for that user?"
//
// Why Map<string, Set<string>>?
// Map   → O(1) lookup by userId
// Set   → a user can be connected on multiple devices simultaneously
//         (phone + laptop). Each device has its own socketId.
//         When we deliver a message, we emit to ALL sockets for that user.
//
// This lives in module scope (singleton per process).
// When we add Redis adapter in v2, this moves to Redis so it's shared
// across multiple server instances.

const userSocketMap = new Map<string, Set<string>>();

// The io instance is stored here so controllers can emit without
// passing io through every function call.
let ioInstance: Server | null = null;

export const socketManager = {
  // Called once in server.ts after Socket.IO is initialized
  setIO(io: Server): void {
    ioInstance = io;
  },

  getIO(): Server {
    if (!ioInstance) throw new Error("Socket.IO not initialized");
    return ioInstance;
  },

  // Called on socket connect — registers this socket under the user
  addSocket(userId: string, socketId: string): void {
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)!.add(socketId);
  },

  // Called on socket disconnect — removes only this socket, not all of them
  // (user might still be connected on another device)
  removeSocket(userId: string, socketId: string): void {
    const sockets = userSocketMap.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSocketMap.delete(userId); // user fully offline
    }
  },

  // Returns all socket IDs for a user — used to deliver messages
  getSockets(userId: string): string[] {
    return Array.from(userSocketMap.get(userId) ?? []);
  },

  // Returns true if a user has at least one active socket connection
  isOnline(userId: string): boolean {
    const sockets = userSocketMap.get(userId);
    return sockets !== undefined && sockets.size > 0;
  },

  // Returns all currently online userIds — used for bulk presence queries
  getOnlineUsers(): string[] {
    return Array.from(userSocketMap.keys());
  },

  // Emits an event to all sockets belonging to a user.
  // Returns true if at least one socket was reachable (user online).
  // Accepts optional io param for backward compat with handlers that pass it.
  emitToUser(
    userIdOrIo: string | Server,
    eventOrUserId: string,
    dataOrEvent: unknown,
    data?: unknown
  ): boolean {
    // Overload resolution:
    // emitToUser(userId, event, data)         — called from controllers
    // emitToUser(io, userId, event, data)     — called from socket handlers
    let userId: string;
    let event: string;
    let payload: unknown;

    if (typeof userIdOrIo === "string") {
      userId = userIdOrIo;
      event = eventOrUserId as string;
      payload = dataOrEvent;
    } else {
      // io was passed as first arg (legacy handler style)
      userId = eventOrUserId as string;
      event = dataOrEvent as string;
      payload = data;
    }

    const io = ioInstance;
    if (!io) return false;

    const socketIds = this.getSockets(userId);
    if (socketIds.length === 0) return false;

    socketIds.forEach((socketId) => {
      io.to(socketId).emit(event, payload);
    });
    return true;
  },

  // Emits to an entire conversation room, optionally excluding a user
  emitToConversation(
    conversationId: string,
    event: string,
    data: unknown,
    excludeUserId?: string
  ): void {
    const io = ioInstance;
    if (!io) return;

    if (excludeUserId) {
      const excludedSockets = this.getSockets(excludeUserId);
      io.to(conversationId).except(excludedSockets).emit(event, data);
    } else {
      io.to(conversationId).emit(event, data);
    }
  },

  // Debug helper — logs the current state of the map
  // Never call this in production — it leaks user data to logs
  debug(): void {
    console.table(
      Array.from(userSocketMap.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size,
        socketIds: Array.from(sockets).join(", "),
      }))
    );
  },
};