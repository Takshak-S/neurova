import { Request, Response } from "express";
import { messageService } from "../services/message.service";
import { socketManager } from "../socket/socketManager";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const messageController = {
  // GET /messages/:conversationId
  // Returns paginated message history using cursor-based pagination.
  // Query params:
  //   ?before=<messageId>  — cursor (ObjectId of oldest message on screen)
  // No cursor = first page (latest messages)
  async getMessages(req: Request, res: Response): Promise<void> {
    const { conversationId } = req.params;
    const before = req.query.before as string | undefined;

    const result = await messageService.getMessages(
      conversationId as string,
      req.user!._id.toString(),
      before
    );

    res.status(200).json(new ApiResponse("Messages fetched", result));
  },

  // POST /messages/:conversationId/read
  // Marks all messages in a conversation as read for the current user.
  // Called when the user opens a conversation.
  // Returns the messageIds that were updated — used to emit read receipts via socket.
  async markAsRead(req: Request, res: Response): Promise<void> {
    const { conversationId } = req.params;
    const userId = req.user!._id.toString();

    const updatedIds = await messageService.markConversationAsRead(
      conversationId as string,
      userId
    );

    // For each updated message, notify the sender via socket.
    // We batch by sender to reduce the number of socket emissions.
    if (updatedIds.length > 0) {
      // We need sender info for each message to route the socket event.
      // In practice, markConversationAsRead returns messages grouped —
      // for now emit a single bulk read event to the room.
      // The conversation room includes the sender, so they receive it.
      socketManager.emitToConversation(
        conversationId as string,
        "messages_read",
        {
          conversationId,
          readBy: userId,
          messageIds: updatedIds,
          readAt: new Date(),
        },
        userId // exclude self — don't tell yourself your own read
      );
    }

    res
      .status(200)
      .json(new ApiResponse("Messages marked as read", { count: updatedIds.length }));
  },
};