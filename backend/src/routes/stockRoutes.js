const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/stockController");

const router = express.Router();
const idParam = z.object({ productId: z.coerce.number().int().positive() });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "sku", "quantity"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

router.use(authenticate, authorize("ADMIN"));
router.get(
  "/",
  validate(z.object({ query: listQuery })),
  asyncHandler(controller.list),
);
router.put(
  "/:productId",
  validate(
    z.object({
      params: idParam,
      body: z.object({ quantity: z.coerce.number().int().min(0) }).strict(),
    }),
  ),
  asyncHandler(controller.adjust),
);

module.exports = router;
