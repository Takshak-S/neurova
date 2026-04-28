import mongoose,{Schema, Document, Types} from "mongoose";

interface IReadReceipt {
    type: Types.ObjectId;
    readAt: Date;
};

export interface IMessage extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    encryptedText: string;
    iv: string;
    type: "text" | "image" | "file" | "voice";
    status: "sent" | "delivered" | "read";
    readBy: IReadReceipt[];
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
};

const MessageSchema = new Schema<IMessage>({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        required: true
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    encryptedText: {
        type: String,
        required: true
    },
    iv: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["text", "image", "file", "voice"],
        default: "text"
    },
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },
    readBy: [
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            readAt: {
                type: Date,
                required: true
            }
        }
    ],

    isDeleted: {
        type: Boolean,
        default: false
    }
},
{
    timestamps: true
});

// PRIMARY INDEX — most critical query: paginate messages in a conversation
// -1 on createdAt because you almost always fetch newest-first
MessageSchema.index({conversationId: 1, createdAt: -1});

// For fetching undelivered messages on reconnect
MessageSchema.index({conversationId: 1, status: 1});

// For a sender's message history (e.g. "delete all my messages")
MessageSchema.index({senderId: 1, createdAt: -1});


export default mongoose.model<IMessage>("Message",MessageSchema);