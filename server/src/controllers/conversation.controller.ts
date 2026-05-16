import { Request, Response } from "express";
import { conversationService } from "../services/conversation.service";
import { messageService } from "../services/message.service";
import { socketManager } from "../socket/socketManager";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { Types } from "mongoose";

export const conversationController = {
  // GET /conversations
  // Returns all conversations for the authenticated user.
  async getConversations(req: Request, res: Response): Promise<void> {
    const conversations = await conversationService.getUserConversations(
      req.user!._id.toString()
    );

    // Annotate each conversation with online status of members.
    // The socketManager knows who's currently connected — no DB query needed.
    const enriched = conversations.map((conv: any) => ({
      ...conv,
      members: conv.members.map((member: any) => ({
        ...member,
        isOnline: socketManager.isOnline(member._id.toString()),
      })),
    }));

    res.status(200).json(new ApiResponse("Conversations fetched", enriched));
  },

  // GET /conversations/requests
  // Returns pending message requests where the user is the recipient.
  async getPendingRequests(req: Request, res: Response): Promise<void> {
    const requests = await conversationService.getPendingRequests(
      req.user!._id.toString()
    );

    res
      .status(200)
      .json(new ApiResponse("Pending requests fetched", requests));
  },

  // POST /conversations
  // Creates or retrieves a direct conversation with another user.
  // The conversation starts as "pending" — the recipient must accept.
  async createConversation(req: Request, res: Response): Promise<void> {
    const { targetUserId } = req.body;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw ApiError.badRequest("Valid targetUserId is required");
    }

    const { conversation, isNew } =
      await conversationService.getOrCreateDirect(
        req.user!._id.toString(),
        targetUserId
      );

    // If the conversation was just created, notify the target user via socket
    // so their conversation list updates in real time without a page refresh.
    if (isNew) {
      socketManager.emitToUser(
        targetUserId,
        "new_conversation_request",
        {
          conversation,
          from: {
            id: req.user!._id,
            name: req.user!.name,
            avatar: req.user!.avatar,
            phone: req.user!.phone,
          },
        }
      );
    }

    res
      .status(isNew ? 201 : 200)
      .json(
        new ApiResponse(
          isNew ? "Conversation request sent" : "Conversation retrieved",
          conversation
        )
      );
  },

  // GET /conversations/:id
  // Returns a single conversation with full member details.
  async getConversation(req: Request, res: Response): Promise<void> {
    const conversation = await conversationService.getById(
      req.params.id as string,
      req.user!._id.toString()
    );

    res.status(200).json(new ApiResponse("Conversation fetched", conversation));
  },

  // PATCH /conversations/:id/accept
  // Accepts a message request. Only the recipient can accept.
  async acceptRequest(req: Request, res: Response): Promise<void> {
    const conversation = await conversationService.acceptRequest(
      req.params.id as string,
      req.user!._id.toString()
    );

    // Notify the requester their message request was accepted.
    // They can now send messages — their UI should unlock the input.
    const requesterId = conversation.requestedBy.toString();
    socketManager.emitToUser(requesterId, "request_accepted", {
      conversationId: conversation._id,
      acceptedBy: {
        id: req.user!._id,
        name: req.user!.name,
        avatar: req.user!.avatar,
      },
    });

    // The accepting user also joins the socket room for this conversation.
    // This is handled automatically on their next socket connect, but we
    // emit the event so the requester's room membership is confirmed.
    res
      .status(200)
      .json(new ApiResponse("Request accepted", conversation));
  },

  // PATCH /conversations/:id/reject
  // Rejects a message request.
  async rejectRequest(req: Request, res: Response): Promise<void> {
    const conversation = await conversationService.rejectRequest(
      req.params.id as string,
      req.user!._id.toString()
    );

    // Optionally notify the requester — some apps silently reject.
    // We notify here for transparency, consistent with the HLD.
    const requesterId = conversation.requestedBy.toString();
    socketManager.emitToUser(requesterId, "request_rejected", {
      conversationId: conversation._id,
    });

    res
      .status(200)
      .json(new ApiResponse("Request rejected", { conversationId: conversation._id }));
  },
};