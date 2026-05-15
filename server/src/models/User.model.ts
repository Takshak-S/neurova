import mongoose,{Schema, Document} from "mongoose";

export interface IUser extends Document {
    phone: string;
    name?: string;
    avatar?: string;
    publicKey?: string; // set after client generates key pair, not at signup
    lastSeen?: Date; // updated by socket on connect/disconnect
    deviceTokens: string[]; // FCM/APNs tokens for offline push notifications
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
        trim: true,
        maxlength: [50, "Name cannot exceed 50 characters"],
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
        default: [],
    }
},
{
    timestamps: true,
    //Remove __v from all queries - it's an internal mongoose field
    // that adds noise and is never needed by the client
    versionKey: false
});

//phone already has a unique index from unique:true above
UserSchema.index({lastSeen:-1});

//Never return sensitive fields by default.
//toJSON transform runs whenever mongoose converts a document to JSON
//(which Express does automatically via res.json())
UserSchema.set("toJSON", {
    transform: (_doc, ret: Record<string, any>)=>{
        delete ret.__v;
        return ret;
    },
});

export default mongoose.model<IUser>("User",UserSchema);