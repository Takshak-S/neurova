import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All conversation routes require authentication
router.use(asyncHandler(authMiddleware));

router.get("/", asyncHandler(conversationController.getConversations));
router.get("/requests", asyncHandler(conversationController.getPendingRequests));
router.post("/", asyncHandler(conversationController.createConversation));
router.get("/:id", asyncHandler(conversationController.getConversation));
router.patch("/:id/accept", asyncHandler(conversationController.acceptRequest));
router.patch("/:id/reject", asyncHandler(conversationController.rejectRequest));

export default router;