"use client";
import { useCallback } from "react";
import { messageEncryption } from "@/lib/crypto/messageEncryption";
import { userAPI } from "@/lib/api/user.api";
import { useAppDispatch } from "@/store/hooks";
import { setDecryptedText } from "@/store/slices/message.slice";
import { Message } from "@/types/api.types";

// useEncryption provides encrypt/decrypt helpers to components.
// Keeps all crypto logic out of components.

export const useEncryption = () => {
    const dispatch = useAppDispatch();

    // Encrypts a message for a recipient — fetches their public key automatically
    const encryptForUser = useCallback(async (
        plaintext: string,
        recipientId: string
    ) => {
        const res = await userAPI.getPublicKey(recipientId);
        const publicKey = res.data.data.publicKey;
        return messageEncryption.encrypt(plaintext, publicKey);
    }, []);

    // Decrypts a message and stores the result in Redux
    const decryptMessage = useCallback(async (message: Message) => {
        if (message.decryptedText || message.isDeleted) return;
        try {
            const text = await messageEncryption.decrypt({
                encryptedText: message.encryptedText,
                iv: message.iv,
            });
            dispatch(setDecryptedText({
                messageId: message._id,
                conversationId: message.conversationId,
                text,
            }));
        } catch {
            dispatch(setDecryptedText({
                messageId: message._id,
                conversationId: message.conversationId,
                text: "⚠️ Unable to decrypt message",
            }));
        }
    }, [dispatch]);

    // Decrypts a batch of messages for AI processing
    const decryptForAI = useCallback(async (
        messages: Message[],
        memberMap: Record<string, string>
    ) => {
        return messageEncryption.decryptBatch(messages, memberMap);
    }, []);

    return { encryptForUser, decryptMessage, decryptForAI };
};