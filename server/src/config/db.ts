import mongoose from "mongoose";
import { env } from "./env";

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export const connectDB = async ():Promise<void> => {
    let attempts=0;

    const connect = async():Promise<void>=>{
        try {
            attempts++;
            await mongoose.connect(env.mongodbUri, {
                // These are the recommended production settings.
                // maxPoolSize: how many simultaneous connections mongoose keeps open.
                // serverSelectionTimeoutMS: how long to wait before giving up on finding a server.
                // socketTimeoutMS: how long an idle socket stays open.   4
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,           
            });

            console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
        } catch (error) {
            console.log(`❌ MongoDB connection attempt ${attempts} failed:`,error);

            if(attempts<MAX_RETRIES) {
                console.log(`⏳ Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
                await new Promise((res)=>setTimeout(res,RETRY_INTERVAL_MS));
                return connect(); //recursive retry
            }

            //Give up after MAX_RETRIES - crash the process so the container
            // orchestrator (Docker/k8s) can restart it with a clean state
            process.exit(1);
        }
    };

    await connect();

    mongoose.connection.on("disconnected", ()=>{
        console.warn("⚠️  MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", ()=>{
        console.log("✅ MongoDB reconnected");
    });

    process.on("SIGINT", async()=>{
        await mongoose.connection.close();
        console.log("MongoDB connection closed (app termination)");
        process.exit(0);
    });
}