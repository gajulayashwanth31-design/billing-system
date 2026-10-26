const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { positiveMoneyAmount } = require("../utils/schemas");
const controller = require("../controllers/invoicesController");

const router = express.Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(["created_at", "status", "grand_total"]).default("created_at"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    status: z.enum(["DRAFT", "FINALIZED", "PAID", "VOID"]).optional(),
    from: date.optional(),
    to: date.optional(),
    cashierId: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must not be later than to",
  });
const createBody = z
  .object({
    customerId: z.coerce.number().int().positive(),
    discountCode: z.string().trim().min(1).max(40).optional(),
    items: z
      .array(
        z
          .object({
            product_id: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().positive().max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

router.use(authenticate);
router.get(
  "/",
  authorize("CASHIER", "ADMIN"),
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.list),
);
router.post(
  "/",
  authorize("CASHIER", "ADMIN"),
  validate(z.object({ body: createBody })),
  asyncHandler(controller.create),
);
router.get(
  "/:id/pdf",
  authorize("CUSTOMER", "CASHIER", "ADMIN"),
  validate(z.object({ params: idParam })),
  asyncHandler(controller.pdfPlaceholder),
);
router.post(
  "/:id/resend-whatsapp",
  authorize("CASHIER", "ADMIN"),
  validate(z.object({ params: idParam })),
  asyncHandler(controller.resendPlaceholder),
);
router.post(
  "/:id/void",
  authorize("ADMIN"),
  validate(
    z.object({
      params: idParam,
      body: z.object({ reason: z.string().trim().min(1).max(500) }).strict(),
    }),
  ),
  asyncHandler(controller.voidInvoice),
);
router.post(
  "/:id/payments",
  authorize("CASHIER", "ADMIN"),
  validate(
    z.object({
      params: idParam,
      body: z
        .object({
          methodId: z.coerce.number().int().positive(),
          amount: positiveMoneyAmount,
          referenceNo: z.string().trim().max(100).optional(),
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.addPayment),
);
router.get(
  "/:id",
  authorize("CASHIER", "ADMIN"),
  validate(z.object({ params: idParam })),
  asyncHandler(controller.getById),
);

module.exports = router;
