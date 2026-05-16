import ConversationModel from "../models/Conversation.model";
import {IConversation} from "../models/Conversation.model";
import {Types} from "mongoose";
import {ApiError} from "../utils/ApiError";
import { request } from "node:http";


export const conversationService={
  // Creates a direct conversation between two users, or returns existing one.
  // The unique partial index on (members, type) where type="direct" prevents
  // duplicates at the DB level — this is belt-and-suspenders logic.

  async getOrCreateDirect(
    requesterId: string,
    targetId: string
  ):Promise<{conversation: IConversation;isNew:boolean}> {
    if (requesterId===targetId) {
        throw ApiError.badRequest("You cannot create a conversation with yourself");
    }

    // Sort members so [A, B] and [B, A] produce the same document
    // The unique index also enforces this, but sorting ensures consistent
    // query results regardless of who initiates

    const memberIds = [requesterId,targetId].map((id)=>new Types.ObjectId(id)).sort();

    const existing = await ConversationModel.findOne({
        members:{
            $all:memberIds
        },
        type:"direct"
    }).populate("members", "name avatar phone publicKey lastSeen");

    if(existing) {
        return {conversation: existing, isNew: false};
    }

    const conversation = await ConversationModel.create({
        members:memberIds,
        type:"direct",
        status:"pending",
        requestedBy:new Types.ObjectId(requesterId),
    });

    await conversation.populate("members", "name avatar phone publicKey lastSeen");

    return {conversation, isNew: true};
  },

  //Returns all conversations of user. sorted by most recently active
  //Populates member data needed for the conversation list UI
  async getUserConversations(userId:string):Promise<IConversation[]> {
    return ConversationModel.find({
        members: userId,
        status: {$ne:"rejected"},
    })
    .sort({updatedAt:-1})
    .populate("members","name avatar phone publicKey lastSeen")
    .populate("lastMessage.senderId","name")
    .lean();
  },

  // Returns pending conversations where the current user is the RECIPIENT
  // (i.e. message requests waiting for their action — accept or reject)
  async getPendingRequests(userId:string):Promise<IConversation[]>{
    return ConversationModel.find({
        members: userId,
        status: "pending",
        requestedBy: {$ne:userId}, //not initiated by this user
    })
    .populate("members","name avatar phone")
    .lean();
  },

  async acceptRequest(conversationId:string,userId:string):Promise<IConversation>{
    const conversation = await ConversationModel.findOne({
        _id:conversationId,
        members: userId,
        status: "pending",
        requestedBy: {$ne:userId}, //only the recipient can accept
    });

    if (!conversation) {
        throw ApiError.notFound("Conversation not found or you can't perform this action");
    }
    
    conversation.status = "accepted";
    await conversation.save();
    return conversation;
  },

  async rejectRequest(conversationId:string,userId:string):Promise<IConversation>{
    const conversation = await ConversationModel.findOne({
        _id:conversationId,
        members: userId,
        status: "pending",
        requestedBy: {$ne:userId}, //only the recipient can reject
    });

    if (!conversation) {
        throw ApiError.notFound("Conversation not found or you can't perform this action");
    }

    conversation.status = "rejected";
    await conversation.save();
    return conversation;
  },

  async getById(conversationId:string,userId:string):Promise<IConversation>{
    const conversation=await ConversationModel.findOne({
        _id:conversationId,
        members:userId,
    }).populate("members","name avatar phone publicKey lastSeen");

    if (!conversation) {
        throw ApiError.notFound("Conversation not found");
    }
    return conversation;
  },
};

