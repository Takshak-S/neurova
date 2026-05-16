import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  validate,
  updateProfileSchema,
  registerPublicKeySchema,
} from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(asyncHandler(authMiddleware));

router.get("/search", asyncHandler(userController.searchByPhone));
router.get("/:id/public-key", asyncHandler(userController.getPublicKey));
router.patch("/me", validate(updateProfileSchema), asyncHandler(userController.updateProfile));
router.post("/me/public-key", validate(registerPublicKeySchema), asyncHandler(userController.registerPublicKey));
router.post("/presence", asyncHandler(userController.getPresence));

export default router;