import MessageModel, { IMessage } from "../models/MessageSchema";
import ConversationModel from "../models/Conversation.model";
import { Types } from "mongoose";
import { ApiError } from "../utils/ApiError";

// Cursor-based pagination explained:
// Offset pagination (skip/limit) has a well-known flaw — if a new message
// arrives while the user is paginating, every page shifts by one and the
// user sees duplicate messages or misses one.
//
// Cursor pagination uses the _id (or createdAt) of the last seen document
// as the cursor. "Give me 30 messages older than THIS message."
// Because _id is immutable and monotonically increasing (for ObjectIds),
// the result set is stable regardless of new inserts.
//
// Client flow:
//   1. First load: GET /messages/:convId → returns latest 30 + lastCursor
//   2. Scroll up: GET /messages/:convId?before=<lastCursor> → returns next 30
//   3. Repeat until hasMore: false

const PAGE_SIZE = 30;

export const messageService = {
  // Returns paginated messages for a conversation.
  // Messages are returned newest-first for the initial fetch,
  // then the client reverses for display (oldest at top).
  async getMessages(
    conversationId: string,
    userId: string,
    before?: string // ObjectId string — cursor
  ): Promise<{
    messages: IMessage[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    // Verify the user is a member of this conversation
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      members: userId,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found or access denied");
    }

    const query: Record<string, unknown> = { conversationId };

    // If a cursor is provided, fetch messages older than the cursor document
    if (before) {
      if (!Types.ObjectId.isValid(before)) {
        throw ApiError.badRequest("Invalid cursor");
      }
      query._id = { $lt: new Types.ObjectId(before) };
    }

    // Fetch one extra document to determine if there are more pages
    const messages = await MessageModel.find(query)
      .sort({ _id: -1 }) // newest first — matches the compound index direction
      .limit(PAGE_SIZE + 1)
      .lean();

    const hasMore = messages.length > PAGE_SIZE;
    const page = hasMore ? messages.slice(0, PAGE_SIZE) : messages;

    return {
      messages: page as IMessage[],
      hasMore,
      // The cursor for the next page is the _id of the oldest message returned
      nextCursor: hasMore ? page[page.length - 1]._id.toString() : null,
    };
  },

  // Marks all unread messages in a conversation as read for a specific user.
  // Called when the user opens a conversation — bulk operation, not per-message.
  // Returns the IDs of messages that were updated (for socket notification).
  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<string[]> {
    // Find messages in this conversation that:
    // - were not sent by this user (can't mark your own as read)
    // - haven't been read by this user yet
    const unread = await MessageModel.find({
      conversationId,
      senderId: { $ne: userId },
      "readBy.userId": { $ne: userId },
    }).select("_id senderId");

    if (unread.length === 0) return [];

    const now = new Date();
    const messageIds = unread.map((m) => m._id);

    // Atomic bulk update — $addToSet prevents duplicate readBy entries
    await MessageModel.updateMany(
      { _id: { $in: messageIds } },
      {
        $addToSet: { readBy: { userId, readAt: now } },
        $set: { status: "read" },
      }
    );

    return messageIds.map((id) => id.toString());
  },

  // Returns all undelivered messages for a user across all conversations.
  // Called on socket reconnect — delivers everything the user missed while offline.
  async getUndeliveredMessages(userId: string): Promise<IMessage[]> {
    // Find all accepted conversations for this user
    const conversations = await ConversationModel.find({
      members: userId,
      status: "accepted",
    }).select("_id");

    const conversationIds = conversations.map((c) => c._id);

    return MessageModel.find({
      conversationId: { $in: conversationIds },
      status: "sent",
      senderId: { $ne: userId },
    })
      .sort({ createdAt: 1 }) // oldest first — deliver in order
      .lean() as Promise<IMessage[]>;
  },
};