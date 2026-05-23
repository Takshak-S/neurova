"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMessages, addOptimisticMessage, confirmMessage, failMessage } from "@/store/slices/message.slice";
import { updateLastMessage } from "@/store/slices/conversation.slice";
import { socketClient } from "@/lib/socket/socket.client";
import { SOCKET_EVENTS } from "@/types/socket.types";
import { useEncryption } from "./useEncryption";
import { Message } from "@/types/api.types";
import { useAppSelector as useSelector } from "@/store/hooks";

export const useMessages = (conversationId: string, recipientId: string) => {
    const dispatch = useAppDispatch();
    const { encryptForUser } = useEncryption();
    const userId = useAppSelector(s => s.auth.user?.id) ?? "";

    const messages = useAppSelector(s => s.messages.byConversation[conversationId] ?? []);
    const hasMore = useAppSelector(s => s.messages.hasMore[conversationId] ?? false);
    const cursor = useAppSelector(s => s.messages.cursors[conversationId] ?? null);
    const loading = useAppSelector(s => s.messages.loading[conversationId] ?? false);

    // Load first page on mount
    useEffect(() => {
        if (conversationId) dispatch(fetchMessages({ conversationId }));
    }, [conversationId, dispatch]);

    const loadMore = useCallback(() => {
        if (hasMore && !loading && cursor) {
            dispatch(fetchMessages({ conversationId, before: cursor }));
        }
    }, [hasMore, loading, cursor, conversationId, dispatch]);

    const sendMessage = useCallback(async (plaintext: string) => {
        const tempId = `temp_${Date.now()}`;

        // Optimistic message — shows immediately, pending server confirmation
        const optimistic: Message = {
            _id: tempId,
            conversationId,
            senderId: userId,
            encryptedText: "",
            iv: "",
            type: "text",
            status: "sent",
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            decryptedText: plaintext,
            isPending: true,
        };

        dispatch(addOptimisticMessage(optimistic));

        try {
            const { encryptedText, iv } = await encryptForUser(plaintext, recipientId);

            // Emit via socket with ack — server confirms and returns the persisted message
            const confirmed = await socketClient.emitWithAck<Message>(
                SOCKET_EVENTS.SEND_MESSAGE,
                { conversationId, encryptedText, iv, type: "text" }
            );

            dispatch(confirmMessage({ tempId, message: { ...confirmed, decryptedText: plaintext } }));
            dispatch(updateLastMessage({
                conversationId,
                encryptedPreview: encryptedText,
                senderId: userId,
                createdAt: confirmed.createdAt,
            }));
        } catch (err) {
            dispatch(failMessage({ tempId, conversationId }));
            throw err;
        }
    }, [conversationId, recipientId, userId, encryptForUser, dispatch]);

    return { messages, hasMore, loading, loadMore, sendMessage };
};