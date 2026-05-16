import { conversationService } from "../../services/conversation.service";
import ConversationModel from "../../models/Conversation.model";
import { ApiError } from "../../utils/ApiError";
import { Types } from "mongoose";

jest.mock("../../models/conversation.model");

const mockConversationModel = ConversationModel as jest.Mocked<typeof ConversationModel>;

describe("conversationService", () => {
  const userA = new Types.ObjectId().toString();
  const userB = new Types.ObjectId().toString();

  beforeEach(() => jest.clearAllMocks());

  describe("getOrCreateDirect()", () => {
    it("should throw 400 if requester and target are the same user", async () => {
      await expect(
        conversationService.getOrCreateDirect(userA, userA)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("should return existing conversation if one already exists", async () => {
      const existing = { _id: new Types.ObjectId(), members: [userA, userB] };
      (mockConversationModel.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(existing),
      });

      const result = await conversationService.getOrCreateDirect(userA, userB);

      expect(result.isNew).toBe(false);
      expect(result.conversation).toEqual(existing);
    });

    it("should create a new conversation if none exists", async () => {
      (mockConversationModel.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const created = {
        _id: new Types.ObjectId(),
        members: [userA, userB],
        status: "pending",
        populate: jest.fn().mockResolvedValue(undefined),
      };
      (mockConversationModel.create as jest.Mock).mockResolvedValue(created);

      const result = await conversationService.getOrCreateDirect(userA, userB);

      expect(result.isNew).toBe(true);
      expect(mockConversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "direct",
          status: "pending",
          requestedBy: expect.any(Types.ObjectId),
        })
      );
    });

    it("should sort members consistently regardless of call order", async () => {
      (mockConversationModel.findOne as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      (mockConversationModel.create as jest.Mock).mockResolvedValue({
        populate: jest.fn().mockResolvedValue(undefined),
        members: [],
      });

      await conversationService.getOrCreateDirect(userA, userB);
      await conversationService.getOrCreateDirect(userB, userA);

      // Both calls should produce the same sorted member array
      const firstCall = (mockConversationModel.create as jest.Mock).mock.calls[0][0];
      const secondCall = (mockConversationModel.create as jest.Mock).mock.calls[1][0];

      expect(firstCall.members.map((m: Types.ObjectId) => m.toString())).toEqual(
        secondCall.members.map((m: Types.ObjectId) => m.toString())
      );
    });
  });

  describe("acceptRequest()", () => {
    it("should throw 404 if conversation not found or user not authorised", async () => {
      (mockConversationModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        conversationService.acceptRequest("conv-id", userA)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should update status to accepted", async () => {
      const mockConv = {
        status: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      (mockConversationModel.findOne as jest.Mock).mockResolvedValue(mockConv);

      await conversationService.acceptRequest("conv-id", userA);

      expect(mockConv.status).toBe("accepted");
      expect(mockConv.save).toHaveBeenCalled();
    });
  });

  describe("rejectRequest()", () => {
    it("should throw 404 if conversation not found", async () => {
      (mockConversationModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        conversationService.rejectRequest("conv-id", userA)
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should update status to rejected", async () => {
      const mockConv = {
        status: "pending",
        save: jest.fn().mockResolvedValue(undefined),
      };
      (mockConversationModel.findOne as jest.Mock).mockResolvedValue(mockConv);

      await conversationService.rejectRequest("conv-id", userA);

      expect(mockConv.status).toBe("rejected");
    });
  });
});