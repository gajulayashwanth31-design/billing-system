const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/adminLogsController");

const router = express.Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

router.get(
  "/audit-log",
  authenticate,
  authorize("ADMIN"),
  validate(
    z.object({
      query: z
        .object({
          ...pagination,
          table: z.string().trim().max(64).optional(),
          userId: z.coerce.number().int().positive().optional(),
          from: date.optional(),
          to: date.optional(),
          sort: z.enum(["changed_at", "table_name"]).default("changed_at"),
          direction: z.enum(["asc", "desc"]).default("desc"),
        })
        .refine((value) => !value.from || !value.to || value.from <= value.to, {
          message: "from must not be later than to",
        }),
    }),
  ),
  asyncHandler(controller.auditLog),
);
router.get(
  "/whatsapp-messages",
  authenticate,
  authorize("ADMIN"),
  validate(
    z.object({
      query: z.object({
        ...pagination,
        status: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED"]).optional(),
        invoiceId: z.coerce.number().int().positive().optional(),
        sort: z.enum(["created_at", "status"]).default("created_at"),
        direction: z.enum(["asc", "desc"]).default("desc"),
      }),
    }),
  ),
  asyncHandler(controller.whatsappMessages),
);

module.exports = router;
