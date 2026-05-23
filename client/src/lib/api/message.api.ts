import apiClient from "./client";
import { APIResponse, MessagePage } from "@/types/api.types";

export const messageAPI = {
    getMessages: (conversationId: string, before?: string) =>
        apiClient.get<APIResponse<MessagePage>>(`/messages/${conversationId}`, {
            params: before ? { before } : undefined,
        }),

    markAsRead: (conversationId: string) =>
        apiClient.post<APIResponse<{ count: number }>>(`/messages/${conversationId}/read`),
};