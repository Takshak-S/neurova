import {Router, Request, Response} from "express";
import authRoutes from "./auth.routes";

const router = Router();

// Health check — used by load balancers and monitoring tools
// to verify the server is alive without hitting the database

router.get("/health", (_req:Request, _res:Response)=>{
    _res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime,
    });
});

router.use("/auth",authRoutes);


export default router;