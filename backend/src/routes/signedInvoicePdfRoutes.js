const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const controller = require("../controllers/publicInvoiceController");

const router = express.Router();

router.get(
  "/:invoiceNo.pdf",
  validate(
    z.object({
      params: z.object({
        invoiceNo: z.string().regex(/^[A-Za-z0-9-]{1,30}$/),
      }),
      query: z.object({
        exp: z.coerce.number().int().positive(),
        sig: z.string().max(128),
      }),
    }),
  ),
  asyncHandler(controller.signedPdf),
);

module.exports = router;
