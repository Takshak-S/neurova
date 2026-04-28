import mongoose,{Schema, Document} from "mongoose";

export interface IUser extends Document {
    phone: string;
    isVerified: boolean;
    name?: string;
    avatar?: string;
    publicKey?: string;
    lastSeen?: Date;
    deviceTokens: string[];
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        trim: true
    },
    avatar: String,
    publicKey: {
        type: String,
        default: null
    },
    lastSeen: {
        type: Date,
        default: null
    },
    deviceTokens: {
        type: [String],
        default: []
    }
},
{
    timestamps: true
});

export default mongoose.model<IUser>("User",UserSchema);