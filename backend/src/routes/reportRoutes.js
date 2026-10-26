const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/reportsController");

const router = express.Router();
const limitedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

router.use(authenticate, authorize("ADMIN"));
router.get("/summary", asyncHandler(controller.summary));
router.get(
  "/sales-by-day",
  validate(z.object({ query: limitedQuery })),
  asyncHandler(controller.salesByDay),
);
router.get("/sales-by-category", asyncHandler(controller.salesByCategory));
router.get("/payment-split", asyncHandler(controller.paymentSplit));
router.get(
  "/top-products",
  validate(z.object({ query: limitedQuery })),
  asyncHandler(controller.topProducts),
);
router.get(
  "/top-cashiers",
  validate(z.object({ query: limitedQuery })),
  asyncHandler(controller.topCashiers),
);
router.get(
  "/low-stock",
  validate(z.object({ query: limitedQuery })),
  asyncHandler(controller.lowStock),
);

module.exports = router;
