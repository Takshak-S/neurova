"use client";
import { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchConversations, setActiveConversation } from "@/store/slices/conversation.slice";

export const useConversations = () => {
    const dispatch = useAppDispatch();
    const conversations = useAppSelector(s => s.conversations.conversations);
    const loading = useAppSelector(s => s.conversations.loading);
    const activeConversationId = useAppSelector(s => s.conversations.activeConversationId);

    useEffect(() => {
        dispatch(fetchConversations());
    }, [dispatch]);

    const setActive = useCallback((id: string | null) => {
        dispatch(setActiveConversation(id));
    }, [dispatch]);

    return { conversations, loading, activeConversationId, setActive };
};
