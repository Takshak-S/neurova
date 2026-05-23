"use client";
import { useEffect, useCallback } from "react";
import { socketClient } from "@/lib/socket/socket.client";
import { SOCKET_EVENTS } from "@/types/socket.types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setConnected, setUserTyping, setUserStopTyping, setUserOnline } from "@/store/slices/socket.slice";
import { addMessage, updateMessageStatus } from "@/store/slices/message.slice";
import { updateLastMessage, upsertConversation, updateMemberOnlineStatus } from "@/store/slices/conversation.slice";
import { Message, Conversation } from "@/types/api.types";

// useSocket initializes the socket connection and registers all global event
// listeners. Called once in the app layout after authentication.
// Returns helpers for emitting events from components.

export const useSocket = () => {
    const dispatch = useAppDispatch();
    const token = useAppSelector(s => s.auth.token);
    const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

    useEffect(() => {
        if (!isAuthenticated || !token) return;

        const socket = socketClient.connect(token);

        socket.on("connect", () => dispatch(setConnected(true)));
        socket.on("disconnect", () => dispatch(setConnected(false)));

        // New message received
        socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: { message: Message }) => {
            dispatch(addMessage(payload.message));
            dispatch(updateLastMessage({
                conversationId: payload.message.conversationId,
                encryptedPreview: payload.message.encryptedText,
                senderId: payload.message.senderId,
                createdAt: payload.message.createdAt,
            }));
        });

        // Message delivery status updated
        socket.on(SOCKET_EVENTS.MESSAGE_STATUS_UPDATE, (payload: {
            messageId: string; conversationId: string; status: "delivered" | "read";
        }) => {
            dispatch(updateMessageStatus(payload));
        });

        // Typing indicators
        socket.on(SOCKET_EVENTS.USER_TYPING, (payload: { conversationId: string; userId: string }) => {
            dispatch(setUserTyping(payload));
        });
        socket.on(SOCKET_EVENTS.USER_STOP_TYPING, (payload: { conversationId: string; userId: string }) => {
            dispatch(setUserStopTyping(payload));
        });

        // Presence
        socket.on(SOCKET_EVENTS.USER_ONLINE, (payload: { userId: string; isOnline: boolean }) => {
            dispatch(setUserOnline(payload));
            dispatch(updateMemberOnlineStatus(payload));
        });

        // New conversation request (someone messaged you for first time)
        socket.on(SOCKET_EVENTS.NEW_CONVERSATION_REQUEST, (payload: { conversation: Conversation }) => {
            dispatch(upsertConversation(payload.conversation));
        });

        // Request accepted
        socket.on(SOCKET_EVENTS.REQUEST_ACCEPTED, (payload: { conversationId: string }) => {
            // Re-fetch that conversation to get updated status
        });

        return () => {
            socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE);
            socket.off(SOCKET_EVENTS.MESSAGE_STATUS_UPDATE);
            socket.off(SOCKET_EVENTS.USER_TYPING);
            socket.off(SOCKET_EVENTS.USER_STOP_TYPING);
            socket.off(SOCKET_EVENTS.USER_ONLINE);
            socket.off(SOCKET_EVENTS.NEW_CONVERSATION_REQUEST);
            socket.off(SOCKET_EVENTS.REQUEST_ACCEPTED);
        };
    }, [isAuthenticated, token, dispatch]);

    const joinConversation = useCallback((conversationId: string) => {
        socketClient.joinConversation(conversationId);
    }, []);

    const emitTyping = useCallback((conversationId: string) => {
        socketClient.sendTyping(conversationId);
    }, []);

    const emitStopTyping = useCallback((conversationId: string) => {
        socketClient.sendStopTyping(conversationId);
    }, []);

    return { joinConversation, emitTyping, emitStopTyping };
};