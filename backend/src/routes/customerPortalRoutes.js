const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/customerPortalController");

const router = express.Router();
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "FINALIZED", "PAID", "VOID"]).optional(),
});

router.use(authenticate, authorize("CUSTOMER"));
router.get("/profile", asyncHandler(controller.profile));
router.put(
  "/profile",
  validate(
    z.object({
      body: z
        .object({
          phone: z
            .string()
            .regex(/^\+91[6-9]\d{9}$/)
            .optional(),
          address: z.string().max(500).nullable().optional(),
        })
        .strict()
        .refine(
          (body) => Object.keys(body).length > 0,
          "At least one field is required",
        ),
    }),
  ),
  asyncHandler(controller.updateProfile),
);
router.get(
  "/invoices",
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.invoices),
);
router.get(
  "/invoices/:id",
  validate(
    z.object({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  ),
  asyncHandler(controller.invoiceById),
);
router.get("/loyalty", asyncHandler(controller.loyalty));

module.exports = router;
