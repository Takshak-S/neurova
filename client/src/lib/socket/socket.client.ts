import { io, Socket } from "socket.io-client";
import { store } from "@/store";
import {
    addMessage,
    updateMessageStatus,
    setDecryptedText,
    clearConversationMessages,
} from "@/store/slices/message.slice";
import {
    upsertConversation,
    updateLastMessage,
    updateMemberOnlineStatus,
    setActiveConversation,
} from "@/store/slices/conversation.slice";
import {
    setConnected,
    setUserTyping,
    setUserStopTyping,
    setUserOnline,
} from "@/store/slices/socket.slice";
import { SOCKET_EVENTS } from "@/types/socket.types";
import type {
    ReceiveMessagePayload,
    MessageStatusPayload,
    MessagesReadPayload,
    TypingPayload,
    UserOnlinePayload,
    RequestAcceptedPayload,
    RequestRejectedPayload,
    NewConversationRequestPayload,
} from "@/types/socket.types";

/**
 * Socket.IO client singleton.
 * 
 * One connection per session, established after login.
 * Handles all real-time events: messages, typing, presence, requests.
 * 
 * Why a singleton?
 * - Socket connections are expensive (server slot + memory)
 * - Creating multiple connections per user causes duplicate events & inconsistency
 * - Redux is the source of truth; socket is just the delivery mechanism
 * 
 * Lifecycle:
 * 1. User logs in → socketClient.connect(token)
 * 2. useSocket hook registers global listeners in app layout
 * 3. Components emit events via socketClient.sendMessage(), etc.
 * 4. User logs out → socketClient.disconnect()
 */

let socket: Socket | null = null;

export const socketClient = {
    /**
     * Establishes the Socket.IO connection.
     * Called once after successful authentication.
     * Returns the socket instance; connection is established immediately.
     */
    connect(token: string): Socket {
        if (socket?.connected) {
            console.log("[Socket] Already connected, reusing socket");
            return socket;
        }

        console.log("[Socket] Connecting to", process.env.NEXT_PUBLIC_SOCKET_URL);

        socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000", {
            // JWT passed on handshake — verified by backend socketAuth middleware
            auth: { token },
            // Use WebSocket first (fastest), fall back to polling for restrictive networks
            transports: ["websocket", "polling"],
            // Reconnection config — exponential backoff
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            // Timeout waiting for the server acknowledgement
            timeout: 20000,
        });

        socketClient.registerHandlers(socket);
        return socket;
    },

    /**
     * Disconnects the socket and cleans up.
     * Called on logout.
     */
    disconnect(): void {
        if (socket) {
            socket.disconnect();
            socket = null;
            console.log("[Socket] Disconnected");
        }
    },

    /**
     * Returns the current socket instance, or null if not connected.
     */
    getSocket(): Socket | null {
        return socket;
    },

    /**
     * Checks if socket is currently connected and authenticated.
     */
    isConnected(): boolean {
        return socket?.connected ?? false;
    },

    // ─── Event Registration ────────────────────────────────────────────────────────
    /**
     * Registers all socket event handlers.
     * Called once on connect; handlers persist until disconnect.
     * 
     * Pattern: server event → Redux dispatch → UI updates from Redux state
     * This keeps socket logic in one place and makes the app reactive.
     */
    registerHandlers(s: Socket): void {
        // ─── Connection Lifecycle ──────────────────────────────────────────────────

        s.on("connect", () => {
            console.log("[Socket] ✅ Connected:", s.id);
            store.dispatch(setConnected(true));
        });

        s.on("disconnect", (reason: string) => {
            console.warn("[Socket] ⚠️ Disconnected:", reason);
            store.dispatch(setConnected(false));
            // If server disconnected us intentionally (auth failure), redirect to login
            if (reason === "io server disconnect") {
                console.error("[Socket] Server disconnected — likely auth failure");
                if (typeof window !== "undefined") {
                    window.location.href = "/login";
                }
            }
        });

        s.on("connect_error", (error: any) => {
            console.error("[Socket] ❌ Connection error:", error.message);
            // Don't dispatch anything yet — let reconnection logic handle it
            // After N retries, the connection will finally fail and we'll redirect
        });

        // ─── Messages ──────────────────────────────────────────────────────────────

        /**
         * RECEIVE_MESSAGE: New message arrived in real-time.
         * The message is already persisted on the server.
         */
        s.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ReceiveMessagePayload) => {
            console.log("[Socket] Message received:", payload.message._id);
            store.dispatch(addMessage(payload.message));

            // Update the "last message" preview in the conversation list
            store.dispatch(
                updateLastMessage({
                    conversationId: payload.conversationId,
                    encryptedPreview: payload.message.encryptedText,
                    senderId: payload.message.senderId,
                    createdAt: payload.message.createdAt,
                })
            );
        });

        /**
         * MESSAGE_STATUS_UPDATE: A message's delivery/read status changed.
         * Sent when: message is delivered to recipient, or marked as read.
         */
        s.on(
            SOCKET_EVENTS.MESSAGE_STATUS_UPDATE,
            (payload: MessageStatusPayload) => {
                console.log(
                    `[Socket] Message ${payload.messageId} marked ${payload.status}`
                );
                store.dispatch(
                    updateMessageStatus({
                        messageId: payload.messageId,
                        conversationId: payload.conversationId,
                        status: payload.status,
                    })
                );
            }
        );

        /**
         * MESSAGES_READ: Bulk read receipt.
         * Sent when user reads multiple messages at once (e.g., opening a conversation).
         */
        s.on(SOCKET_EVENTS.MESSAGES_READ, (payload: MessagesReadPayload) => {
            console.log(
                `[Socket] ${payload.messageIds.length} messages marked read by ${payload.readBy}`
            );
            // Mark each message as read
            payload.messageIds.forEach((messageId) => {
                store.dispatch(
                    updateMessageStatus({
                        messageId,
                        conversationId: payload.conversationId,
                        status: "read",
                    })
                );
            });
        });

        /**
         * UNDELIVERED_MESSAGES: Messages sent to this user while they were offline.
         * Delivered immediately on reconnect/join.
         */
        s.on(SOCKET_EVENTS.UNDELIVERED_MESSAGES, (payload: { messages: any[] }) => {
            console.log(`[Socket] Received ${payload.messages.length} undelivered messages`);
            payload.messages.forEach((msg) => {
                store.dispatch(addMessage(msg));
            });
        });

        // ─── Typing Indicators ─────────────────────────────────────────────────────

        /**
         * USER_TYPING: Someone started typing in a conversation.
         * Ephemeral — not persisted, just broadcast to active users.
         */
        s.on(SOCKET_EVENTS.USER_TYPING, (payload: TypingPayload) => {
            console.log(
                `[Socket] ${payload.userId} typing in ${payload.conversationId}`
            );
            store.dispatch(
                setUserTyping({
                    conversationId: payload.conversationId,
                    userId: payload.userId,
                })
            );
        });

        /**
         * USER_STOP_TYPING: Someone stopped typing or 2 seconds passed with no keystroke.
         */
        s.on(SOCKET_EVENTS.USER_STOP_TYPING, (payload: TypingPayload) => {
            console.log(
                `[Socket] ${payload.userId} stopped typing in ${payload.conversationId}`
            );
            store.dispatch(
                setUserStopTyping({
                    conversationId: payload.conversationId,
                    userId: payload.userId,
                })
            );
        });

        // ─── Presence ──────────────────────────────────────────────────────────────

        /**
         * USER_ONLINE: User came online or went offline (presence update).
         */
        s.on(SOCKET_EVENTS.USER_ONLINE, (payload: UserOnlinePayload) => {
            console.log(
                `[Socket] ${payload.userId} is ${payload.isOnline ? "online" : "offline"}`
            );
            store.dispatch(
                setUserOnline({ userId: payload.userId, isOnline: payload.isOnline })
            );
            store.dispatch(
                updateMemberOnlineStatus({
                    userId: payload.userId,
                    isOnline: payload.isOnline,
                })
            );
        });

        // ─── Conversation Requests (Message Request System) ───────────────────────

        /**
         * NEW_CONVERSATION_REQUEST: Someone messaged you and you're not connected yet.
         * Shows as "pending" conversation until you accept/reject.
         */
        s.on(
            SOCKET_EVENTS.NEW_CONVERSATION_REQUEST,
            (payload: NewConversationRequestPayload) => {
                console.log(
                    `[Socket] New message request from ${payload.from.phone}`
                );
                store.dispatch(upsertConversation(payload.conversation));
            }
        );

        /**
         * REQUEST_ACCEPTED: Someone accepted your message request.
         * Conversation status changes from "pending" to "accepted".
         */
        s.on(
            SOCKET_EVENTS.REQUEST_ACCEPTED,
            (payload: RequestAcceptedPayload) => {
                console.log(
                    `[Socket] Request accepted for conversation ${payload.conversationId}`
                );
                // Fetch the updated conversation from the server via Redux thunk
                // This ensures we have the latest state
                // For now, just log — the app should refetch on demand
            }
        );

        /**
         * REQUEST_REJECTED: Someone rejected your message request.
         * Conversation is deleted or marked as rejected.
         */
        s.on(
            SOCKET_EVENTS.REQUEST_REJECTED,
            (payload: RequestRejectedPayload) => {
                console.log(
                    `[Socket] Request rejected for conversation ${payload.conversationId}`
                );
                // Remove from Redux state
                store.dispatch(
                    clearConversationMessages(payload.conversationId)
                );
            }
        );
    },

    // ─── Emit Helpers ──────────────────────────────────────────────────────────────
    /**
     * Sends a message via Socket.IO.
     * Server will ack with the persisted Message object.
     */
    sendMessage(payload: {
        conversationId: string;
        encryptedText: string;
        iv: string;
        type?: string;
    }): Promise<any> {
        if (!socket?.connected) {
            return Promise.reject(new Error("Socket not connected"));
        }
        console.log("[Socket] Emitting send_message for", payload.conversationId);
        return socketClient.emitWithAck(SOCKET_EVENTS.SEND_MESSAGE, payload);
    },

    /**
     * Tells other users you're typing.
     * Auto-stops after 2 seconds of inactivity.
     */
    sendTyping(conversationId: string): void {
        if (!socket?.connected) return;
        socket.emit(SOCKET_EVENTS.TYPING, { conversationId });
    },

    /**
     * Tells other users you stopped typing.
     * Or is sent automatically after 2 seconds of no activity.
     */
    sendStopTyping(conversationId: string): void {
        if (!socket?.connected) return;
        socket.emit(SOCKET_EVENTS.STOP_TYPING, { conversationId });
    },

    /**
     * Joins a conversation room.
     * Called when the user opens a conversation.
     * Auto-triggers undelivered messages delivery.
     */
    joinConversation(conversationId: string): void {
        if (!socket?.connected) {
            console.warn("[Socket] Cannot join — socket not connected");
            return;
        }
        console.log("[Socket] Joining conversation", conversationId);
        socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, { conversationId });
    },

    /**
     * Marks a message as read.
     * If called multiple times in quick succession, batches them server-side.
     */
    markMessageRead(conversationId: string, messageId: string): void {
        if (!socket?.connected) return;
        socket.emit(SOCKET_EVENTS.MARK_READ, { conversationId, messageId });
    },

    /**
     * Generic emit with acknowledgement.
     * Promise resolves when server acks with a response.
     * Throws if socket disconnects before ack arrives.
     */
    emitWithAck<T = any>(event: string, ...args: any[]): Promise<T> {
        if (!socket?.connected) {
            return Promise.reject(new Error("Socket not connected"));
        }
        return new Promise((resolve, reject) => {
            socket!.emit(event, ...args, (response: T) => {
                resolve(response);
            });
            // Timeout if server doesn't ack within 10 seconds
            setTimeout(() => {
                reject(new Error(`Socket ack timeout for event: ${event}`));
            }, 10000);
        });
    },

    /**
     * Generic emit without acknowledgement.
     * Fire-and-forget pattern for ephemeral events like typing.
     */
    emit<T = any>(event: string, data?: T): void {
        if (!socket?.connected) {
            console.warn(`[Socket] Cannot emit ${event} — socket not connected`);
            return;
        }
        socket.emit(event, data);
    },
};
