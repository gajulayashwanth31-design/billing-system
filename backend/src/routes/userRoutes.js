const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/usersController");

const router = express.Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const password = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/);
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["username", "created_at"]).default("username"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
const idSchema = z.object({ params: idParam });

router.use(authenticate, authorize("ADMIN"));
router.get(
  "/",
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.list),
);
router.get("/:id", validate(idSchema), asyncHandler(controller.getById));
router.post(
  "/",
  validate(
    z.object({
      body: z
        .object({
          username: z.string().trim().min(3).max(80),
          password,
          role: z.enum(["CUSTOMER", "CASHIER", "ADMIN"]),
          customerId: z.coerce.number().int().positive().optional(),
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
          username: z.string().trim().min(3).max(80).optional(),
          isActive: z.boolean().optional(),
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
router.post(
  "/:id/activate",
  validate(idSchema),
  asyncHandler((req, res) => controller.setActive(req, res, true)),
);
router.post(
  "/:id/deactivate",
  validate(idSchema),
  asyncHandler((req, res) => controller.setActive(req, res, false)),
);
router.post(
  "/:id/reset-password",
  validate(
    z.object({ params: idParam, body: z.object({ password }).strict() }),
  ),
  asyncHandler(controller.resetPassword),
);
router.delete("/:id", validate(idSchema), asyncHandler(controller.remove));

module.exports = router;
