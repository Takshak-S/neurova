import apiClient from "./client";
import { APIResponse, AIResult, AIMessage, AIFeature, AIHealthResponse } from "@/types/api.types";

// AI API — sends decrypted messages to the backend for processing.
// Messages are decrypted client-side before calling these endpoints.

export const aiAPI = {
    process(feature: AIFeature, messages: AIMessage[], conversationId: string) {
        return apiClient.post<APIResponse<AIResult>>("/ai/process", {
            feature,
            messages,
            conversationId,
        });
    },

    health() {
        return apiClient.get<APIResponse<AIHealthResponse>>("/ai/health");
    },
};
