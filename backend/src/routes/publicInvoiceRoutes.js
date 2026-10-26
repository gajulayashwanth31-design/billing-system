const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/publicInvoiceController");

const router = express.Router();
const invoiceNo = z.string().regex(/^[A-Za-z0-9-]{1,30}$/);

router.get(
  "/verify/:invoiceNo",
  validate(
    z.object({
      params: z.object({ invoiceNo }),
      query: z.object({ h: z.string().max(128).optional() }),
    }),
  ),
  asyncHandler(controller.verify),
);

module.exports = router;
