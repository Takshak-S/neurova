import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/socketAuth.middleware";
import { socketManager } from "../socketManager";
import ConversationModel from "../../models/Conversation.model";
import MessageModel from "../../models/MessageSchema";
import UserModel from "../../models/User.model";

export const registerPresenceHandlers = (
  io: Server,
  socket: AuthenticatedSocket
): void => {
  // ── join_conversation ──────────────────────────────────────────────────────
  // Joins the user to a Socket.IO room for that conversation.
  // Rooms allow us to emit to all participants without iterating the member list.
  // The user joins their conversation rooms on every connect — rooms are
  // ephemeral (they don't persist across disconnects).

  socket.on(
    "join_conversation",
    async ({ conversationId }: { conversationId: string }) => {
      try {
        // Verify membership before joining the room
        const conversation = await ConversationModel.findOne({
          _id: conversationId,
          members: socket.userId,
        });

        if (!conversation) return;

        await socket.join(conversationId);

        // Deliver any messages that were sent while this user was offline
        const undelivered = await MessageModel.find({
          conversationId,
          status: "sent",
          senderId: { $ne: socket.userId }, // not sent by this user
        }).sort({ createdAt: 1 }); // oldest first

        if (undelivered.length > 0) {
          socket.emit("undelivered_messages", {
            conversationId,
            messages: undelivered,
          });

          // Mark them delivered now that the user is online and received them
          await MessageModel.updateMany(
            {
              _id: { $in: undelivered.map((m) => m._id) },
            },
            { status: "delivered" }
          );

          // Notify senders
          const senderIds = [
            ...new Set(undelivered.map((m) => m.senderId.toString())),
          ];
          for (const senderId of senderIds) {
            socketManager.emitToUser(io, senderId, "messages_delivered_bulk", {
              conversationId,
              messageIds: undelivered
                .filter((m) => m.senderId.toString() === senderId)
                .map((m) => m._id),
            });
          }
        }
      } catch (error) {
        console.error("[join_conversation] error:", error);
      }
    }
  );

  // ── typing ────────────────────────────────────────────────────────────────
  // Broadcasts to all OTHER members of the conversation.
  // We use the room (conversationId) and exclude the sender with
  // socket.to() which broadcasts to everyone in the room except the sender.

  socket.on(
    "typing",
    ({ conversationId }: { conversationId: string }) => {
      socket.to(conversationId).emit("user_typing", {
        conversationId,
        userId: socket.userId,
      });
    }
  );

  // ── stop_typing ───────────────────────────────────────────────────────────

  socket.on(
    "stop_typing",
    ({ conversationId }: { conversationId: string }) => {
      socket.to(conversationId).emit("user_stop_typing", {
        conversationId,
        userId: socket.userId,
      });
    }
  );

  // ── disconnect ────────────────────────────────────────────────────────────
  // Fires automatically when the socket connection drops.
  // We remove this specific socket from the map (user may still be connected
  // on another device), update lastSeen, and notify contacts if fully offline.

  socket.on("disconnect", async () => {
    try {
      socketManager.removeSocket(socket.userId, socket.id);

      // Update lastSeen timestamp
      await UserModel.findByIdAndUpdate(socket.userId, {
        lastSeen: new Date(),
      });

      // If user is now fully offline (no remaining sockets), notify contacts
      if (!socketManager.isOnline(socket.userId)) {
        await notifyContactsOfPresence(io, socket.userId, false);
      }
    } catch (error) {
      console.error("[disconnect] error:", error);
    }
  });
};

// ── Presence broadcast ───────────────────────────────────────────────────────
// Notifies all contacts of a user's online/offline status.
// Called on connect (online) and full disconnect (offline).
// We only notify users who share an accepted conversation — not all users.

export const notifyContactsOfPresence = async (
  io: Server,
  userId: string,
  isOnline: boolean
): Promise<void> => {
  // Find all accepted conversations this user is part of
  const conversations = await ConversationModel.find({
    members: userId,
    status: "accepted",
  }).select("members");

  // Collect unique contact IDs
  const contactIds = new Set<string>();
  for (const conv of conversations) {
    for (const memberId of conv.members) {
      const id = memberId.toString();
      if (id !== userId) contactIds.add(id);
    }
  }

  // Emit presence update to each online contact
  for (const contactId of contactIds) {
    socketManager.emitToUser(io, contactId, "presence_update", {
      userId,
      isOnline,
      lastSeen: isOnline ? null : new Date(),
    });
  }
};