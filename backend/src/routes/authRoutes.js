const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { loginRateLimiter } = require("../middleware/rateLimiter");
const controller = require("../controllers/authController");

const router = express.Router();
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a number");

router.post(
  "/login",
  loginRateLimiter,
  validate(
    z.object({
      body: z
        .object({
          username: z.string().trim().min(1).max(80),
          password: z.string().min(1).max(128),
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.login),
);
router.get("/me", authenticate, asyncHandler(controller.me));
router.post(
  "/change-password",
  authenticate,
  validate(
    z.object({
      body: z
        .object({
          currentPassword: z.string().min(1).max(128),
          newPassword: passwordSchema,
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.changePassword),
);

module.exports = router;
