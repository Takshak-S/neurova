import mongoose,{Schema, Document, Types} from "mongoose";

interface IReadReceipt {
    userId: Types.ObjectId;
    readAt: Date;
};

export interface IMessage extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    encryptedText: string; //never plain text - always encypted
    iv: string;             // required — cannot decrypt without it
    type: "text" | "image" | "file" | "voice";
    status: "sent" | "delivered" | "read";
    readBy: IReadReceipt[];  //group-aware read-receipts
    isDeleted: boolean;     //soft delete
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
    timestamps: true,
    versionKey:false
});

// PRIMARY - paginate messages in a conversation newest-first
MessageSchema.index({conversationId: 1, createdAt: -1});

// Fetch undelivered messages on reconnect
MessageSchema.index({conversationId: 1, status: 1});

// Sender message history
MessageSchema.index({senderId: 1, createdAt: -1});


export default mongoose.model<IMessage>("Message",MessageSchema);