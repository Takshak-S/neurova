import UserModel, { IUser } from "../models/User.model";
import { ApiError } from "../utils/ApiError";

export const userService = {
  // Search for a user by exact phone number.
  // We do not expose fuzzy search — privacy by design.
  // You must know the exact phone number to find someone.
  async findByPhone(
    phone: string,
    requesterId: string
  ): Promise<Partial<IUser> | null> {
    const user = await UserModel.findOne({ phone })
      .select("_id name avatar phone publicKey lastSeen")
      .lean();

    if (!user) return null;

    // Never return your own profile from search
    if (user._id.toString() === requesterId) {
      throw ApiError.badRequest("Cannot search for yourself");
    }

    return user;
  },

  // Returns a user's public key — needed by the sender before encrypting.
  // This endpoint is called before sending the first message to a new contact.
  async getPublicKey(userId: string): Promise<string> {
    const user = await UserModel.findById(userId).select("publicKey");

    if (!user) throw ApiError.notFound("User not found");
    if (!user.publicKey) {
      throw ApiError.badRequest(
        "This user has not set up encryption keys yet"
      );
    }

    return user.publicKey;
  },

  // Updates the authenticated user's profile
  async updateProfile(
    userId: string,
    updates: { name?: string; avatar?: string }
  ): Promise<IUser> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-deviceTokens");

    if (!user) throw ApiError.notFound("User not found");
    return user;
  },

  // Registers or updates the client's public key.
  // Called once after key generation on the client — idempotent.
  async registerPublicKey(
    userId: string,
    publicKey: string
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { publicKey });
  },

  // Returns online status for a list of userIds.
  // Used by the conversation list to show green dots.
  async getPresence(
    userIds: string[],
    onlineUserIds: string[]
  ): Promise<Record<string, { isOnline: boolean; lastSeen: Date | null }>> {
    const users = await UserModel.find({
      _id: { $in: userIds },
    }).select("_id lastSeen");

    const onlineSet = new Set(onlineUserIds);
    const result: Record<string, { isOnline: boolean; lastSeen: Date | null }> =
      {};

    for (const user of users) {
      const id = user._id.toString();
      result[id] = {
        isOnline: onlineSet.has(id),
        lastSeen: user.lastSeen ?? null,
      };
    }

    return result;
  },
};