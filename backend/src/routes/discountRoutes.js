const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { moneyAmount, positiveMoneyAmount } = require("../utils/schemas");
const controller = require("../controllers/discountsController");

const router = express.Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const discountFields = z
  .object({
    code: z.string().trim().min(1).max(40),
    type: z.enum(["PERCENT", "FLAT"]),
    value: positiveMoneyAmount,
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
    minBillAmount: moneyAmount.default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
const discountBody = discountFields.refine(
  (body) =>
    new Date(body.validTo) > new Date(body.validFrom) &&
    (body.type !== "PERCENT" || body.value <= 100),
  {
    message:
      "Discount dates must be ordered and percent values cannot exceed 100",
  },
);
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["code", "value", "valid_from"]).default("code"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

router.use(authenticate, authorize("CASHIER", "ADMIN"));
router.post(
  "/validate",
  validate(
    z.object({
      body: z
        .object({
          code: z.string().trim().min(1).max(40),
          billAmount: moneyAmount,
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.validateCode),
);
router.get(
  "/",
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.list),
);
router.get(
  "/:id",
  validate(z.object({ params: idParam })),
  asyncHandler(controller.getById),
);
router.post(
  "/",
  authorize("ADMIN"),
  validate(z.object({ body: discountBody })),
  asyncHandler(controller.create),
);
router.put(
  "/:id",
  authorize("ADMIN"),
  validate(
    z.object({
      params: idParam,
      body: discountFields
        .partial()
        .refine(
          (body) =>
            Object.keys(body).length > 0 &&
            (body.type !== "PERCENT" ||
              body.value === undefined ||
              body.value <= 100),
          "At least one field is required and percent values cannot exceed 100",
        ),
    }),
  ),
  asyncHandler(controller.update),
);
router.delete(
  "/:id",
  authorize("ADMIN"),
  validate(z.object({ params: idParam })),
  asyncHandler(controller.remove),
);

module.exports = router;
