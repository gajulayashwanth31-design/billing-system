const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("CASHIER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const methods = await query(
      req.user.role,
      "SELECT method_id AS id, name FROM payment_methods ORDER BY name",
    );
    return res.json({ data: methods });
  }),
);

module.exports = router;
