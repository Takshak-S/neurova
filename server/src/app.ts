import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import {env} from "./config/env";

import router from "./routes";

import {errorMiddleware} from "./middleware/error.middleware";
import {ApiError} from "./utils/ApiError";

const app = express();
// ─── Security middleware ──────────────────────────────────────────────────────
// helmet sets secure HTTP headers — prevents a class of well-known attacks
// (clickjacking, MIME sniffing, etc.) with zero configuration
app.use(helmet());

// CORS 

app.use(
    cors({
        origin: (origin, callback) => {
            //ALLOW REQUESTS WITH NO ORIGIN (POSTMAN, CURL)
            if (!origin) return callback(null,true);
            if (env.allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            callback(new Error(`CORS: Origin ${origin} not allowed`));
        },
        credentials: true, //allow cookies and Authorization headers
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({limit: "10kb"})); //reject payloads > 10kb (DoS protection)
app.use(express.urlencoded({extended: true, limit: "10kb"}));

// ─── Logging ──────────────────────────────────────────────────────────────────
// "dev" format in development — colorized, concise
// "combined" format in production — full Apache-style log for log aggregators

app.use(morgan(env.isProduction?"combined":"dev"));

// Routes 
app.use("/api/v1", router);

// 404 handler - catches any route that doesn't match 
app.use((_req,_res,next)=>{
    next(ApiError.notFound("Route not found"));
});

// Error handler 
app.use(errorMiddleware);

export default app;