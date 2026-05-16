import { Socket } from "socket.io";
import { tokenService } from "../../services/token.service";
import UserModel from "../../models/User.model";

// Socket.IO middleware runs once per connection attempt, before any event handlers.
// It's the equivalent of Express auth middleware but for WebSocket connections.
//
// The client must pass the JWT as a handshake auth parameter:
//   socket = io(SERVER_URL, { auth: { token: "Bearer <jwt>" } })
//
// If this middleware calls next(new Error(...)), the connection is rejected.
// The client receives a "connect_error" event with the error message.

export interface AuthenticatedSocket extends Socket {
  userId: string;
  phone: string;
}

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    // Token comes from handshake auth — never from socket data/query
    // (query params appear in server logs and browser history)
    const { token } = socket.handshake.auth as { token?: string };

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Strip "Bearer " prefix if present
    const rawToken = token.startsWith("Bearer ") ? token.slice(7) : token;

    // verify() throws if invalid or expired — caught by try/catch below
    const payload = tokenService.verify(rawToken);

    // Confirm user still exists in DB
    const user = await UserModel.findById(payload.userId).select("_id phone");
    if (!user) {
      return next(new Error("User not found"));
    }

    // Attach to socket — accessible in all handlers via socket.userId
    (socket as AuthenticatedSocket).userId = user._id.toString();
    (socket as AuthenticatedSocket).phone = user.phone;

    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    next(new Error(message));
  }
};