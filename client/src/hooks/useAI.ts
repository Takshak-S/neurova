"use client";
import { useState, useCallback } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { aiAPI } from "@/lib/api/ai.api";
import { useEncryption } from "./useEncryption";
import { closeAIPanel } from "@/store/slices/ui.slice";
import { AIFeature, AIResult } from "@/types/api.types";
import { extractErrorMessage } from "@/lib/api/client";

export const useAI = (conversationId: string) => {
  const dispatch = useAppDispatch();
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messages = useAppSelector(s => s.messages.byConversation[conversationId] ?? []);
  const conversations = useAppSelector(s => s.conversations.conversations);
  const conversation = conversations.find(c => c._id === conversationId);
  const { decryptForAI } = useEncryption();

  const process = useCallback(async (feature: AIFeature) => {
    if (!conversation) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Build member name map for AI context
      const memberMap = Object.fromEntries(
        conversation.members.map(m => [m.id, m.name ?? m.phone])
      );

      // Decrypt all messages client-side before sending to AI
      const decrypted = await decryptForAI(messages, memberMap);

      const res = await aiAPI.process(feature, decrypted, conversationId);
      setResult(res.data.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [conversation, messages, conversationId, decryptForAI]);

  const dismiss = useCallback(() => {
    dispatch(closeAIPanel());
    setResult(null);
    setError(null);
  }, [dispatch]);

  return { process, result, loading, error, dismiss };
};