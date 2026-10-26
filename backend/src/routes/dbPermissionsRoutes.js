const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/dbPermissionsController");

const router = express.Router();

router.post(
  "/db-permissions",
  authenticate,
  authorize("ADMIN"),
  validate(
    z.object({
      body: z
        .object({
          role: z.enum(["CUSTOMER", "CASHIER", "ADMIN"]),
          action: z.enum([
            "select_products",
            "update_product_price",
            "delete_product",
            "insert_invoice",
            "select_audit_log",
          ]),
        })
        .strict(),
    }),
  ),
  asyncHandler(controller.run),
);

module.exports = router;
