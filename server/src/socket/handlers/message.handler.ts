import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/socketAuth.middleware";
import { socketManager } from "../socketManager";
import MessageModel from "../../models/MessageSchema";
import ConversationModel from "../../models/Conversation.model";
import UserModel from "../../models/User.model";
import { Types } from "mongoose";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  conversationId: string;
  encryptedText: string; // always encrypted — client encrypts before sending
  iv: string;            // initialization vector for decryption
  type?: "text" | "image" | "file" | "voice";
}

export interface MessageAck {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const registerMessageHandlers = (
  io: Server,
  socket: AuthenticatedSocket
): void => {
  // ── send_message ──────────────────────────────────────────────────────────
  //
  // Flow:
  // 1. Validate payload
  // 2. Verify sender is a member of the conversation
  // 3. Verify conversation is accepted (not pending/rejected)
  // 4. PERSIST to MongoDB first — message is never lost even if socket drops
  // 5. Acknowledge to sender (optimistic UI can now confirm delivery)
  // 6. Update conversation.lastMessage
  // 7. Emit to all receiver sockets
  // 8. Update status to "delivered" if receiver is online
  //
  // The callback (ack) is Socket.IO's acknowledgement mechanism —
  // the client passes a callback as the last argument to socket.emit()
  // and the server calls it here to confirm receipt.

  socket.on(
    "send_message",
    async (payload: SendMessagePayload, ack: (response: MessageAck) => void) => {
      try {
        const { conversationId, encryptedText, iv, type = "text" } = payload;

        // ── Validation ──────────────────────────────────────────────────────
        if (!conversationId || !encryptedText || !iv) {
          return ack({
            success: false,
            error: "conversationId, encryptedText, and iv are required",
          });
        }

        if (!Types.ObjectId.isValid(conversationId)) {
          return ack({ success: false, error: "Invalid conversationId" });
        }

        // ── Authorisation ───────────────────────────────────────────────────
        const conversation = await ConversationModel.findOne({
          _id: conversationId,
          members: socket.userId, // sender must be a member
        });

        if (!conversation) {
          return ack({
            success: false,
            error: "Conversation not found or access denied",
          });
        }

        if (conversation.status !== "accepted") {
          return ack({
            success: false,
            error:
              "Cannot send messages to a pending or rejected conversation",
          });
        }

        // ── Persist first ───────────────────────────────────────────────────
        // This is the persist-first pattern.
        // The message is durably saved BEFORE we attempt socket delivery.
        // If the emit fails (receiver offline, network drop), the message
        // is not lost — it sits in MongoDB with status "sent" until the
        // receiver reconnects and fetches undelivered messages.
        const message = await MessageModel.create({
          conversationId,
          senderId: socket.userId,
          encryptedText,
          iv,
          type,
          status: "sent",
        });

        // ── Acknowledge to sender ────────────────────────────────────────────
        // Call the ack BEFORE emitting to receiver.
        // The sender's optimistic UI (showing "sending...") resolves to a
        // checkmark as soon as the server confirms persistence — regardless
        // of whether the receiver is online.
        ack({ success: true, messageId: message._id.toString() });

        // ── Update conversation.lastMessage ──────────────────────────────────
        await ConversationModel.findByIdAndUpdate(conversationId, {
          lastMessage: {
            encryptedPreview: encryptedText,
            senderId: socket.userId,
            createdAt: message.createdAt,
          },
          updatedAt: new Date(), // bump updatedAt so conversation list re-sorts
        });

        // ── Emit to all receiver sockets ─────────────────────────────────────
        const receiverIds = conversation.members
          .map((id) => id.toString())
          .filter((id) => id !== socket.userId);

        let deliveredToAny = false;

        for (const receiverId of receiverIds) {
          const delivered = socketManager.emitToUser(
            io,
            receiverId,
            "receive_message",
            {
              message: {
                _id: message._id,
                conversationId,
                senderId: socket.userId,
                encryptedText,
                iv,
                type,
                status: "sent",
                createdAt: message.createdAt,
              },
            }
          );

          if (delivered) deliveredToAny = true;
        }

        // ── Update status to "delivered" if at least one receiver is online ──
        if (deliveredToAny) {
          await MessageModel.findByIdAndUpdate(message._id, {
            status: "delivered",
          });

          // Notify sender that the message was delivered
          socket.emit("message_status_update", {
            messageId: message._id,
            status: "delivered",
          });
        }
      } catch (error) {
        console.error("[send_message] error:", error);
        ack({ success: false, error: "Failed to send message" });
      }
    }
  );

  // ── message_read ──────────────────────────────────────────────────────────
  // Emitted by the receiver when they open a conversation and see the messages.

  socket.on(
    "message_read",
    async ({ messageId }: { messageId: string }) => {
      try {
        if (!Types.ObjectId.isValid(messageId)) return;

        const message = await MessageModel.findById(messageId);
        if (!message) return;

        // Only the receiver can mark as read — not the sender
        if (message.senderId.toString() === socket.userId) return;

        // Add to readBy array if not already present (idempotent)
        const alreadyRead = message.readBy.some(
          (r) => r.userId.toString() === socket.userId
        );

        if (!alreadyRead) {
          await MessageModel.findByIdAndUpdate(messageId, {
            $push: {
              readBy: { userId: socket.userId, readAt: new Date() },
            },
            status: "read",
          });

          // Notify the sender their message was read
          socketManager.emitToUser(
            io,
            message.senderId.toString(),
            "message_status_update",
            { messageId, status: "read" }
          );
        }
      } catch (error) {
        console.error("[message_read] error:", error);
      }
    }
  );
};