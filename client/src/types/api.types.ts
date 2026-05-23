// api.types.ts
// Complete type definitions mirroring backend response shapes.
// These types are the contract between frontend and backend.
// If backend changes a field, TypeScript will surface every breaking change.

// ─── API Response Wrapper ──────────────────────────────────────────────────────
// Every API endpoint returns this shape wrapped around the actual data

export interface APIResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

// ─── User ──────────────────────────────────────────────────────────────────────
// User profile with presence & crypto keys

export interface User {
    id: string;
    phone: string;
    name?: string;
    avatar?: string;
    publicKey?: string;        // base64 SPKI format — used to encrypt messages TO this user
    lastSeen?: string;         // ISO datetime of last activity
    isOnline?: boolean;        // populated by presence tracking, not persisted
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
// OTP flow responses

export interface SendOTPResponse {
    phone: string;
    expiresInMinutes: number;
}

export interface VerifyOTPResponse {
    token: string;             // JWT — store in localStorage
    isNewUser: boolean;        // true = user needs onboarding + key generation
    user: User;
}

// ─── Conversation ──────────────────────────────────────────────────────────────
// Direct (1:1) or group chats with message request system

export type ConversationStatus = "pending" | "accepted" | "rejected";
export type ConversationType = "direct" | "group";

export interface LastMessage {
    encryptedPreview: string;  // RSA-OAEP encrypted message start
    senderId: string;
    createdAt: string;         // ISO datetime
    // Client-populated after decryption
    decryptedPreview?: string;
}

export interface Conversation {
    _id: string;               // MongoDB ObjectId
    members: User[];           // 2 for direct, 3+ for group
    type: ConversationType;
    status: ConversationStatus;
    requestedBy: string;       // userId of who initiated for "pending" conversations
    lastMessage?: LastMessage;
    groupName?: string;        // only for type: "group"
    groupAvatar?: string;      // only for type: "group"
    createdAt: string;         // ISO datetime
    updatedAt: string;         // ISO datetime
}

// ─── Message ────────────────────────────────────────────────────────────────────
// End-to-end encrypted messages with delivery tracking

export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "file" | "voice";

export interface ReadReceipt {
    userId: string;
    readAt: string;            // ISO datetime when user marked as read
}

export interface Message {
    _id: string;               // MongoDB ObjectId
    conversationId: string;    // Reference to parent conversation
    senderId: string;          // Reference to user who sent
    encryptedText: string;     // base64(RSA key + AES ciphertext)
    iv: string;                // base64(AES-GCM IV)
    type: MessageType;         // currently only "text" is implemented
    status: MessageStatus;     // delivery status for the sender
    readBy: ReadReceipt[];     // for groups — tracks who read this message
    isDeleted: boolean;        // soft delete — message still in DB but marked deleted
    createdAt: string;         // ISO datetime
    updatedAt: string;         // ISO datetime

    // ─── Client-side only (never from server) ────────────────────────────────────
    decryptedText?: string;    // populated after Web Crypto decryption
    isPending?: boolean;       // optimistic UI — message sent but awaiting server confirmation
    isFailed?: boolean;        // optimistic UI — send failed, show retry button
}

// ─── Message Pagination ────────────────────────────────────────────────────────
// Cursor-based pagination for message history (oldest messages last, stable under new inserts)

export interface MessagePage {
    messages: Message[];       // sorted newest-first from server, reversed for display
    hasMore: boolean;          // true = more messages exist older than this page
    nextCursor: string | null; // _id of oldest message on this page — pass as `before=` for next fetch
}

// ─── AI Features ───────────────────────────────────────────────────────────────
// User-triggered AI processing on decrypted conversation data

export type AIFeature = "summarize" | "reply" | "tasks";

export interface AIMessage {
    senderId: string;
    senderName?: string;       // display name for context
    content: string;           // plaintext — client MUST decrypt before sending to server
    createdAt: string;         // ISO datetime
}

// Discriminated union — TypeScript knows feature: "reply" → result: string[]
export type AIResult =
    | { feature: "summarize"; result: string }
    | { feature: "reply"; result: string[] }        // always 3 suggestions
    | { feature: "tasks"; result: string[] };       // variable length

export interface AIHealthResponse {
    provider: string;          // "groq" or "ollama"
    model: string;             // e.g. "llama-3.1-8b-instant"
    available: boolean;        // true = AI service is reachable
}

// ─── Socket Events (message passing during live chat) ──────────────────────────
// These are sent/received via Socket.IO, not REST

export interface ReceiveMessagePayload {
    message: Message;
    conversationId: string;
}

export interface MessageStatusPayload {
    messageId: string;
    conversationId: string;
    status: "delivered" | "read";
}

export interface MessagesReadPayload {
    conversationId: string;
    readBy: string;
    messageIds: string[];
    readAt: string;
}

export interface TypingPayload {
    conversationId: string;
    userId: string;
    userName?: string;
}

export interface UserOnlinePayload {
    userId: string;
    isOnline: boolean;
    lastSeen?: string;
}

export interface RequestAcceptedPayload {
    conversationId: string;
    acceptedBy: { id: string; name?: string; avatar?: string };
}

export interface RequestRejectedPayload {
    conversationId: string;
}

export interface NewConversationRequestPayload {
    conversation: Conversation;
    from: { id: string; name?: string; avatar?: string; phone: string };
}

// ─── Error Responses ───────────────────────────────────────────────────────────
// Backend sends these on 400/401/403/500

export interface ErrorPayload {
    success: false;
    message: string;
    code?: string;             // e.g. "RATE_LIMIT", "INVALID_OTP", "UNAUTHORIZED"
    statusCode: number;
}

// ─── Pagination Query Params ───────────────────────────────────────────────────
// Used in conversation list and message history

export interface PaginationParams {
    limit?: number;            // default 20
    offset?: number;           // for offset-based (legacy)
    before?: string;           // for cursor-based (preferred) — message _id
    after?: string;            // for cursor-based
}

// ─── Rate Limit Response Headers ────────────────────────────────────────────────
// Returned in X-RateLimit-* headers for any rate-limited endpoint

export interface RateLimitInfo {
    limit: number;             // max requests in window
    remaining: number;         // requests left
    reset: number;             // timestamp when limit resets
}

// ─── Search Results ────────────────────────────────────────────────────────────
// User search by phone

export interface UserSearchResult {
    user: User | null;         // null if not found (privacy by design)
}

// ─── Presence Bulk Query ────────────────────────────────────────────────────────
// Check online status for up to 100 users at once

export interface PresenceBulkResponse {
    [userId: string]: {
        isOnline: boolean;
        lastSeen: string | null;  // null if online, ISO datetime if offline
    };
}

// ─── Profile Update ────────────────────────────────────────────────────────────
// Partial updates (name, avatar)

export interface ProfileUpdatePayload {
    name?: string;
    avatar?: string;           // data URL or URL to image
}

// ─── Public Key Registration ───────────────────────────────────────────────────
// One-time registration of encryption public key

export interface PublicKeyRegistrationPayload {
    publicKey: string;         // base64 SPKI format
}

export interface PublicKeyResponse {
    publicKey: string;         // echoed back for verification
}

// ─── Conversation Creation ────────────────────────────────────────────────────
// Creates new direct conversation or retrieves existing

export interface CreateConversationPayload {
    targetUserId: string;      // who to message
}

// Response is the full Conversation object

// ─── Message Send (via Socket.IO, not REST) ────────────────────────────────────
// Client emits to server with ack callback

export interface SendMessagePayload {
    conversationId: string;
    encryptedText: string;
    iv: string;
    type: "text";              // only text for now
}

// Server acks with the persisted Message

// ─── Typing Indicator ──────────────────────────────────────────────────────────
// Ephemeral — not persisted, just broadcasts to other users

export interface TypingStartPayload {
    conversationId: string;
}

export interface TypingStopPayload {
    conversationId: string;
}

// ─── Conversation Request Actions ─────────────────────────────────────────────
// Accept or reject a "pending" conversation

export interface AcceptRequestPayload {
    // no body — path param is conversationId
}

export interface RejectRequestPayload {
    // no body — path param is conversationId
}

// Response is the updated Conversation (status: "accepted" or removed entirely)

// ─── Bulk Read Receipts ────────────────────────────────────────────────────────
// Mark all messages in a conversation as read

export interface MarkReadPayload {
    // no body — path param is conversationId
}

export interface MarkReadResponse {
    count: number;             // how many messages marked as read
}

// ─── Configuration Types ───────────────────────────────────────────────────────
// Used in Redux stores and context

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isNewUser: boolean;
    loading: boolean;
    error: string | null;
}

export interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    loading: boolean;
    error: string | null;
}

export interface MessageState {
    byConversation: Record<string, Message[]>;  // conversationId → messages
    cursors: Record<string, string | null>;     // conversationId → nextCursor
    hasMore: Record<string, boolean>;           // conversationId → hasMore
    loading: Record<string, boolean>;           // conversationId → loading
    error: string | null;
}

export interface SocketState {
    isConnected: boolean;
    typingUsers: Record<string, string[]>;      // conversationId → userIds typing
    onlineUsers: Set<string>;                   // userIds online
}

export interface UIState {
    theme: "light" | "dark" | "system";
    aiPanelOpen: boolean;
    aiFeature: AIFeature | null;
    newChatModalOpen: boolean;
}

// ─── Combined App State ────────────────────────────────────────────────────────

export interface AppState {
    auth: AuthState;
    conversations: ConversationState;
    messages: MessageState;
    socket: SocketState;
    ui: UIState;
}