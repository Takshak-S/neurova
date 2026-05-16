import { Router } from "express";
import { messageController } from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(asyncHandler(authMiddleware));

// GET /messages/:conversationId?before=<cursor>
router.get("/:conversationId", asyncHandler(messageController.getMessages));

// POST /messages/:conversationId/read
router.post("/:conversationId/read", asyncHandler(messageController.markAsRead));

export default router;