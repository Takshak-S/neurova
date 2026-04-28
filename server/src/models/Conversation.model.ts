import mongoose,{Schema, Document, Types} from 'mongoose';

interface ILastMessage {
    encryptedPreview: string;
    senderId: Types.ObjectId;
    createdAt: Date;
}

export interface IConversation extends Document {
    members: Schema.Types.ObjectId[];
    type: "direct" | "group";
    status: "pending" | "accepted" | "rejected";
    requestedBy: Types.ObjectId;
    lastMessage?: ILastMessage;
    groupName?: string;
    groupAvatar?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
    members: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: [
        {
          // direct must have exactly 2 members, group between 3 and 256
          validator: function (val: Types.ObjectId[]) {
            if ((this as IConversation).type === "direct") return val.length === 2;
            if ((this as IConversation).type === "group") return val.length >= 3 && val.length <= 256;
            return false;
          },
          message: "Direct conversations need exactly 2 members; groups need 3–256.",
        },
      ],
    },

    type: {
        type:String,
        enum: ["direct", "group"],
        default: "direct"
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending"
    },
    requestedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    lastMessage: {
        encryptedPreview: String,
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        createdAt: Date
    },
    groupName: {
        type: String,
        trim: true
    },
    groupAvatar: String
},
{
    timestamps: true
});

// Primary query: "all conversations for this user" + filter by status
ConversationSchema.index({members: 1});
ConversationSchema.index({members: 1, status: 1});

// Prevent duplicate direct conversations between the same two users
// Partial filter ensures this only applies to direct type
ConversationSchema.index(
    {members: 1, type: 1},
    {
        unique: true,
        partialFilterExpression: {type: "direct"},
        name: "unique_direct_conversation"
    }
)

export default mongoose.model<IConversation>("Conversation", ConversationSchema);