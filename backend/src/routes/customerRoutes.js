const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/customersController");

const router = express.Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "created_at"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
const phone = z.string().regex(/^\+91[6-9]\d{9}$/);

router.use(authenticate, authorize("CASHIER", "ADMIN"));
router.get(
  "/by-phone/:phone",
  validate(z.object({ params: z.object({ phone }) })),
  asyncHandler(controller.getByPhone),
);
router.get(
  "/",
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.list),
);
router.post(
  "/",
  validate(
    z.object({
      body: z
        .object({
          name: z.string().trim().min(1).max(150),
          phone,
          email: z.string().email().max(254).optional(),
          address: z.string().max(500).optional(),
          whatsappOptIn: z.boolean().default(false),
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.create),
);
router.put(
  "/:id",
  validate(
    z.object({
      params: idParam,
      body: z
        .object({
          name: z.string().trim().min(1).max(150).optional(),
          phone: phone.optional(),
          email: z.string().email().max(254).nullable().optional(),
          address: z.string().max(500).nullable().optional(),
          whatsappOptIn: z.boolean().optional(),
        })
        .strict()
        .refine(
          (body) => Object.keys(body).length > 0,
          "At least one field is required",
        ),
    }),
  ),
  asyncHandler(controller.update),
);

module.exports = router;
