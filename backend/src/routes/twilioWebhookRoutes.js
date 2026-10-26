const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/twilioWebhookController");

const router = express.Router();

router.post(
  "/status",
  validate(
    z.object({
      body: z.object({
        MessageSid: z.string().min(1).max(120),
        MessageStatus: z.enum([
          "accepted",
          "queued",
          "sending",
          "sent",
          "delivered",
          "read",
          "failed",
          "undelivered",
        ]),
        ErrorMessage: z.string().max(2000).optional(),
      }),
    }),
  ),
  asyncHandler(controller.status),
);

module.exports = router;
