import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { socketManager } from "../socket/socketManager";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const userController = {
  // GET /users/search?phone=+919876543210
  // Searches for a user by exact E.164 phone number.
  // No fuzzy search — privacy by design.
  async searchByPhone(req: Request, res: Response): Promise<void> {
    const { phone } = req.query;

    if (!phone || typeof phone !== "string") {
      throw ApiError.badRequest(
        "phone query parameter is required (E.164 format)"
      );
    }

    const user = await userService.findByPhone(
      phone,
      req.user!._id.toString()
    );

    if (!user) {
      // Return empty result, not 404.
      // 404 would confirm to an attacker that no user exists with that number.
      // Empty result is ambiguous — user may exist but chose not to be discoverable.
      // (Discoverability settings can be added in a later phase.)
      res
        .status(200)
        .json(new ApiResponse("Search complete", { user: null }));
      return;
    }

    // Annotate with online status
    const userId = (user as any)._id.toString();
    const enriched = {
      ...user,
      isOnline: socketManager.isOnline(userId),
    };

    res.status(200).json(new ApiResponse("User found", { user: enriched }));
  },

  // GET /users/:id/public-key
  // Returns a user's public key — needed by the sender to encrypt a message.
  // Only authenticated users can fetch public keys.
  async getPublicKey(req: Request, res: Response): Promise<void> {
    const publicKey = await userService.getPublicKey(req.params.id as string);
    res.status(200).json(new ApiResponse("Public key fetched", { publicKey }));
  },

  // PATCH /users/me
  // Updates the authenticated user's name or avatar.
  async updateProfile(req: Request, res: Response): Promise<void> {
    const { name, avatar } = req.body;
    const user = await userService.updateProfile(
      req.user!._id.toString(),
      { name, avatar }
    );
    res.status(200).json(new ApiResponse("Profile updated", user));
  },

  // POST /users/me/public-key
  // Registers the client's public key after key generation.
  // Idempotent — can be called again if the user regenerates their key pair.
  async registerPublicKey(req: Request, res: Response): Promise<void> {
    const { publicKey } = req.body;
    if (!publicKey) throw ApiError.badRequest("publicKey is required");

    await userService.registerPublicKey(
      req.user!._id.toString(),
      publicKey
    );

    res
      .status(200)
      .json(new ApiResponse("Public key registered", null));
  },

  // POST /users/presence
  // Returns online status for a list of user IDs.
  // Called by the conversation list to show green dots.
  async getPresence(req: Request, res: Response): Promise<void> {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw ApiError.badRequest("userIds must be a non-empty array");
    }

    if (userIds.length > 100) {
      throw ApiError.badRequest("Maximum 100 userIds per request");
    }

    const onlineUsers = socketManager.getOnlineUsers();
    const presence = await userService.getPresence(userIds, onlineUsers);

    res.status(200).json(new ApiResponse("Presence fetched", presence));
  },
};