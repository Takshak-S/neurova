import mongoose,{Schema, Document} from "mongoose";

export interface IOTP extends Document {
    phone: string;
    hashedOTP: string;
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
    hashedOTP: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
        //max is enforced in the service layer, not the schema,
        // because we want to return a specific error response, not a mongoose error
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
    },
    versionKey:false
});

// MongoDB TTL index — automatically deletes the document when expiresAt is reached.
// expireAfterSeconds: 0 means "delete at exactly expiresAt", not N seconds after it.
// MongoDB's TTL cleanup runs every 60 seconds, so deletion may lag by up to 1 minute.
// That's acceptable — the service layer also checks expiresAt manually.
OTPSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

//index phone for fast lookup during verification
OTPSchema.index({phone: 1});

export default mongoose.model<IOTP>("OTP", OTPSchema);