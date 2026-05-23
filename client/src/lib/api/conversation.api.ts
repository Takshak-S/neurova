import apiClient from "./client";
import { APIResponse, Conversation } from "@/types/api.types";

export const conversationAPI = {
    getAll() {
        return apiClient.get<APIResponse<Conversation[]>>("/conversations");
    },

    getById(id: string) {
        return apiClient.get<APIResponse<Conversation>>(`/conversations/${id}`);
    },

    create(targetUserId: string) {
        return apiClient.post<APIResponse<Conversation>>("/conversations", { targetUserId });
    },

    accept(conversationId: string) {
        return apiClient.patch<APIResponse<Conversation>>(`/conversations/${conversationId}/accept`);
    },

    reject(conversationId: string) {
        return apiClient.patch<APIResponse<Conversation>>(`/conversations/${conversationId}/reject`);
    },
};
