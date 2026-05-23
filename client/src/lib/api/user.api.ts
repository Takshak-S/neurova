import apiClient from "./client";
import { APIResponse, User } from "@/types/api.types";

export const userAPI = {
    searchByPhone: (phone: string) =>
        apiClient.get<APIResponse<{ user: User | null }>>(`/users/search`, { params: { phone } }),

    getPublicKey: (userId: string) =>
        apiClient.get<APIResponse<{ publicKey: string }>>(`/users/${userId}/public-key`),

    updateProfile: (data: { name?: string; avatar?: string }) =>
        apiClient.patch<APIResponse<User>>("/users/me", data),

    registerPublicKey: (publicKey: string) =>
        apiClient.post<APIResponse<null>>("/users/me/public-key", { publicKey }),

    getPresence: (userIds: string[]) =>
        apiClient.post<APIResponse<Record<string, { isOnline: boolean; lastSeen: string | null }>>>(
            "/users/presence",
            { userIds }
        ),
};