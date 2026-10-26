const express = require("express");
const { z } = require("zod");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const { moneyAmount } = require("../utils/schemas");
const controller = require("../controllers/catalogController");

function createCatalogRouter(resource) {
  const router = express.Router();
  const idParam = z.object({ id: z.coerce.number().int().positive() });
  const listQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    sort:
      resource === "categories"
        ? z.enum(["name", "created_at"]).default("name")
        : resource === "tax-rates"
          ? z.enum(["name", "rate_percent"]).default("name")
          : z.enum(["name", "sku", "price"]).default("name"),
    direction: z.enum(["asc", "desc"]).default("asc"),
    ...(resource === "products"
      ? { categoryId: z.coerce.number().int().positive().optional() }
      : {}),
  });
  const body =
    resource === "categories"
      ? z.object({ name: z.string().trim().min(1).max(100) }).strict()
      : resource === "tax-rates"
        ? z
            .object({
              name: z.string().trim().min(1).max(50),
              ratePercent: moneyAmount.max(100),
            })
            .strict()
        : z
            .object({
              sku: z.string().trim().min(1).max(50),
              name: z.string().trim().min(1).max(180),
              categoryId: z.coerce.number().int().positive(),
              taxId: z.coerce.number().int().positive(),
              price: moneyAmount,
              reorderLevel: z.coerce.number().int().min(0),
              initialStock: z.coerce.number().int().min(0).default(0),
              isActive: z.boolean().default(true),
            })
            .strict();

  router.use(authenticate, authorize("CASHIER", "ADMIN"));
  router.get(
    "/",
    validate(z.object({ query: listQuery })),
    asyncHandler((req, res) =>
      controller.list(resource, req.user.role)(req, res),
    ),
  );
  router.get(
    "/:id",
    validate(z.object({ params: idParam })),
    asyncHandler((req, res) =>
      controller.getById(resource, req.user.role)(req, res),
    ),
  );
  router.post(
    "/",
    authorize("ADMIN"),
    validate(z.object({ body })),
    asyncHandler((req, res) => controller.create(resource)(req, res)),
  );
  router.put(
    "/:id",
    authorize("ADMIN"),
    validate(
      z.object({
        params: idParam,
        body: body
          .omit(resource === "products" ? { initialStock: true } : {})
          .partial()
          .refine(
            (value) => Object.keys(value).length > 0,
            "At least one field is required",
          ),
      }),
    ),
    asyncHandler((req, res) => controller.update(resource)(req, res)),
  );
  router.delete(
    "/:id",
    authorize("ADMIN"),
    validate(z.object({ params: idParam })),
    asyncHandler((req, res) => controller.remove(resource)(req, res)),
  );
  return router;
}

module.exports = createCatalogRouter;
