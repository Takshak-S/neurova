import express from "express";
import https from "https";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

import connectDB from "./config/db";
import authRouter from "./routes/auth.route";
import { authMiddleware } from "./middleware/auth.middleware";

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth routes (public) ────────────────────────────────────
app.use("/auth", authRouter);

// ── Protected routes (require JWT) ──────────────────────────
// Example: app.use("/api", authMiddleware, apiRouter);
// Any route registered after this middleware will require a valid JWT.
app.get("/me", authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// ── HTTPS server ────────────────────────────────────────────
const server = https.createServer(
    {
        key: fs.readFileSync("localhost-key.pem"),
        cert: fs.readFileSync("localhost.pem"),
    },
    app
);

const PORT = process.env.PORT || 5000;

// ── Start ───────────────────────────────────────────────────
const start = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

start();