import { Request, Response } from "express";
import { aiService } from "../ai/ai.service";
import { AIRequest } from "../ai/types";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const aiController = {
  // POST /ai/process
  // The core AI endpoint. The client sends decrypted messages + feature type.
  // We process and return the result.
  //
  // Security model:
  // - Client decrypts messages before calling this endpoint
  // - We receive plaintext for THIS request only
  // - We never store the plaintext — it lives only in the request lifecycle
  // - The conversationId is for audit logging only — never sent to the AI
  async process(req: Request, res: Response): Promise<void> {
    const { feature, messages, conversationId } = req.body as AIRequest;

    // Basic field presence check — Zod validation in middleware handles
    // the full schema, but we guard here too for defence-in-depth
    if (!feature || !messages || !conversationId) {
      throw ApiError.badRequest("feature, messages, and conversationId are required");
    }

    const result = await aiService.process({
      feature,
      messages,
      conversationId,
    });

    res.status(200).json(
      new ApiResponse("AI processing complete", result)
    );
  },

  // GET /ai/health
  // Checks if the configured AI provider is reachable.
  // Called by monitoring tools and the frontend to show "AI unavailable" banners.
  async health(req: Request, res: Response): Promise<void> {
    const health = await aiService.checkHealth();

    res.status(health.available ? 200 : 503).json(
      new ApiResponse(
        health.available ? "AI provider is available" : "AI provider is unavailable",
        health
      )
    );
  },
};