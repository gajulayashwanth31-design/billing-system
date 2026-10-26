const { z } = require("zod");

const moneyAmount = z.coerce
  .number()
  .min(0)
  .max(9999999999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Amount must have no more than two decimal places",
  });
const positiveMoneyAmount = moneyAmount.refine((value) => value > 0, {
  message: "Amount must be greater than zero",
});

module.exports = { moneyAmount, positiveMoneyAmount };
