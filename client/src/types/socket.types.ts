import { Message, ConversationStatus } from "./api.types";

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
    conversation: import("./api.types").Conversation;
    from: { id: string; name?: string; avatar?: string; phone: string };
}

export const SOCKET_EVENTS = {
    SEND_MESSAGE: "send_message",
    JOIN_CONVERSATION: "join_conversation",
    TYPING: "typing",
    STOP_TYPING: "stop_typing",
    MARK_READ: "mark_read",
    RECEIVE_MESSAGE: "receive_message",
    MESSAGE_STATUS_UPDATE: "message_status_update",
    MESSAGES_READ: "messages_read",
    USER_TYPING: "user_typing",
    USER_STOP_TYPING: "user_stop_typing",
    USER_ONLINE: "presence_update",
    NEW_CONVERSATION_REQUEST: "new_conversation_request",
    REQUEST_ACCEPTED: "request_accepted",
    REQUEST_REJECTED: "request_rejected",
    UNDELIVERED_MESSAGES: "undelivered_messages",
} as const;