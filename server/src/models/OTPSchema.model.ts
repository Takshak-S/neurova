import mongoose,{Schema, Document} from "mongoose";

export interface IOTP extends Document {
    phone: string;
    otp: string;
    expiresAt: Date;
    attempts: number;
    createdAt: Date;
}

const OTPSchema = new Schema<IOTP>({
    phone:{
        type: String,
        required: true,
        trim: true
    },
    // In production: store hash of OTP, not the raw value
    otp: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0,
        max: 5
    },
    expiresAt: {
        type: Date,
        required: true
    }
},
{
    timestamps: {
        createdAt: true,
        updatedAt: false
    }
});
// Auto-delete document when expiresAt is reached
// expireAfterSeconds: 0 means "delete exactly at expiresAt"
OTPSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

// FIX: index phone for fast lookup during verification
OTPSchema.index({phone: 1});

export default mongoose.model<IOTP>("OTP", OTPSchema);