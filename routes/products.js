const express = require("express");

const router = express.Router();

const {
  supabase,
} = require("../config/supabase");

const {
  requireAuth,
  requireAdmin,
} = require("../middleware/auth");

/* =========================================================
   HELPERS
========================================================= */

function normalizeJson(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
}

function normalizeImages(images) {
  if (!images) {
    return [];
  }

  if (typeof images === "string") {
    return images.trim() ? [images.trim()] : [];
  }

  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => {
      if (typeof image === "string") {
        return image.trim();
      }

      if (image && typeof image === "object") {
        return (
          image.url ||
          image.publicUrl ||
          image.image_url ||
          ""
        );
      }

      return "";
    })
    .filter(Boolean);
}

function toNumberOrNull(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function toNumberOrZero(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function cleanProductPayload(body = {}) {
  const {
    name,
    slug,
    description,
    price,
    compare_at_price,
    compare_price,
    sale_price,
    sku,
    category_id,
    badge,
    images,
    features,
    specifications,
    stock,
    rating,
    review_count,
    featured,
    is_active,
    active,
    sort_order,
  } = body;

  const payload = {
    name:
      typeof name === "string"
        ? name.trim()
        : name,

    slug:
      typeof slug === "string"
        ? slug.trim()
        : slug,

    description:
      typeof description === "string"
        ? description.trim()
        : description || "",

    price:
      toNumberOrZero(price),

    compare_at_price:
      compare_at_price !== undefined
        ? toNumberOrNull(compare_at_price)
        : toNumberOrNull(compare_price),

    sale_price:
      toNumberOrNull(sale_price),

    category_id:
      category_id || null,

    images:
      normalizeImages(images),

    stock:
      toNumberOrZero(stock),

    featured:
      featured === true,

    is_active:
      is_active !== undefined
        ? is_active !== false
        : active !== undefined
          ? active !== false
          : true,

    features:
      normalizeJson(features, []),

    specifications:
      normalizeJson(specifications, {}),

    sort_order:
      toNumberOrZero(sort_order),

    rating:
      toNumberOrZero(rating),

    review_count:
      toNumberOrZero(review_count),
  };

  if (sku !== undefined) {
    payload.sku =
      typeof sku === "string"
        ? sku.trim()
        : sku;
  }

  if (badge !== undefined) {
    payload.badge =
      typeof badge === "string"
        ? badge.trim()
        : badge;
  }

  return payload;
}

function sendDatabaseError(res, error, fallbackMessage) {
  console.error(
    "DATABASE ERROR:",
    {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    }
  );

  return res.status(400).json({
    success: false,
    message:
      error?.message ||
      fallbackMessage,
    details:
      error?.details ||
      null,
    hint:
      error?.hint ||
      null,
    code:
      error?.code ||
      null,
  });
}

/* =========================================================
   PUBLIC — ACTIVE PRODUCTS
========================================================= */

router.get(
  "/",
  async (req, res, next) => {
    try {
      const {
        category,
        search,
        featured,
      } = req.query;

      let query = supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order,
          created_at,
          updated_at
        `)
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        })
        .order("created_at", {
          ascending: false,
        });

      if (category) {
        query = query.eq(
          "category_id",
          category
        );
      }

      if (featured === "true") {
        query = query.eq(
          "featured",
          true
        );
      }

      if (search) {
        const safeSearch =
          search.trim();

        if (safeSearch) {
          query = query.or(
            `name.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`
          );
        }
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        products: data || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADMIN — ALL PRODUCTS
========================================================= */

router.get(
  "/all",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        data,
        error,
      } = await req.supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order,
          created_at,
          updated_at
        `)
        .order("sort_order", {
          ascending: true,
        })
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        products: data || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADMIN — CREATE PRODUCT
========================================================= */

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const payload =
        cleanProductPayload(
          req.body
        );

      /* ---------------------------------------------------
         BASIC VALIDATION
      --------------------------------------------------- */

      if (!payload.name) {
        return res.status(400).json({
          success: false,
          message:
            "Product name is required.",
        });
      }

      if (!payload.slug) {
        return res.status(400).json({
          success: false,
          message:
            "Product slug is required.",
        });
      }

      if (
        !Number.isFinite(
          payload.price
        ) ||
        payload.price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product price is invalid.",
        });
      }

      if (
        payload.sale_price !== null &&
        payload.sale_price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Sale price cannot be negative.",
        });
      }

      if (
        payload.compare_at_price !== null &&
        payload.compare_at_price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Compare price cannot be negative.",
        });
      }

      if (
        payload.stock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Stock cannot be negative.",
        });
      }

      /* ---------------------------------------------------
         CATEGORY VALIDATION
      --------------------------------------------------- */

      if (payload.category_id) {
        const {
          data: category,
          error: categoryError,
        } = await req.supabase
          .from("categories")
          .select(
            "id, is_active"
          )
          .eq(
            "id",
            payload.category_id
          )
          .maybeSingle();

        if (categoryError) {
          console.error(
            "CATEGORY CHECK ERROR:",
            categoryError
          );

          return sendDatabaseError(
            res,
            categoryError,
            "Unable to verify product category."
          );
        }

        if (!category) {
          return res.status(400).json({
            success: false,
            message:
              "Selected category does not exist.",
          });
        }

        if (category.is_active === false) {
          return res.status(400).json({
            success: false,
            message:
              "Selected category is inactive.",
          });
        }
      }

      /* ---------------------------------------------------
         SLUG CHECK
      --------------------------------------------------- */

      const {
        data: existing,
        error: existingError,
      } = await req.supabase
        .from("products")
        .select("id")
        .eq(
          "slug",
          payload.slug
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "SLUG CHECK ERROR:",
          existingError
        );

        return sendDatabaseError(
          res,
          existingError,
          "Unable to verify product slug."
        );
      }

      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "A product with this slug already exists.",
        });
      }

      /* ---------------------------------------------------
         CREATE
      --------------------------------------------------- */

      const {
        data,
        error,
      } = await req.supabase
        .from("products")
        .insert(payload)
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        return sendDatabaseError(
          res,
          error,
          "Unable to create product."
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Product created successfully.",
        product: data,
      });
    } catch (error) {
      console.error(
        "CREATE PRODUCT ERROR:",
        {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        }
      );

      next(error);
    }
  }
);

/* =========================================================
   ADMIN — UPDATE PRODUCT
========================================================= */

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const productId =
        req.params.id;

      /* ---------------------------------------------------
         EXISTING PRODUCT
      --------------------------------------------------- */

      const {
        data: existingProduct,
        error: existingError,
      } = await req.supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order
        `)
        .eq(
          "id",
          productId
        )
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found.",
        });
      }

      const payload =
        cleanProductPayload(
          req.body
        );

      /* ---------------------------------------------------
         IMAGE PROTECTION
      --------------------------------------------------- */

      const incomingImages =
        normalizeImages(
          req.body?.images
        );

      const existingImages =
        normalizeImages(
          existingProduct.images
        );

      payload.images =
        incomingImages.length > 0
          ? incomingImages
          : existingImages;

      /* ---------------------------------------------------
         VALIDATION
      --------------------------------------------------- */

      if (!payload.name) {
        return res.status(400).json({
          success: false,
          message:
            "Product name is required.",
        });
      }

      if (!payload.slug) {
        return res.status(400).json({
          success: false,
          message:
            "Product slug is required.",
        });
      }

      if (
        !Number.isFinite(
          payload.price
        ) ||
        payload.price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product price is invalid.",
        });
      }

      if (
        payload.sale_price !== null &&
        payload.sale_price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Sale price cannot be negative.",
        });
      }

      if (
        payload.compare_at_price !== null &&
        payload.compare_at_price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Compare price cannot be negative.",
        });
      }

      if (
        payload.stock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Stock cannot be negative.",
        });
      }

      /* ---------------------------------------------------
         CATEGORY VALIDATION
      --------------------------------------------------- */

      if (payload.category_id) {
        const {
          data: category,
          error: categoryError,
        } = await req.supabase
          .from("categories")
          .select(
            "id, is_active"
          )
          .eq(
            "id",
            payload.category_id
          )
          .maybeSingle();

        if (categoryError) {
          return sendDatabaseError(
            res,
            categoryError,
            "Unable to verify product category."
          );
        }

        if (!category) {
          return res.status(400).json({
            success: false,
            message:
              "Selected category does not exist.",
          });
        }

        if (category.is_active === false) {
          return res.status(400).json({
            success: false,
            message:
              "Selected category is inactive.",
          });
        }
      }

      /* ---------------------------------------------------
         SLUG COLLISION
      --------------------------------------------------- */

      if (
        payload.slug !==
        existingProduct.slug
      ) {
        const {
          data: slugProduct,
          error: slugError,
        } = await req.supabase
          .from("products")
          .select("id")
          .eq(
            "slug",
            payload.slug
          )
          .neq(
            "id",
            productId
          )
          .maybeSingle();

        if (slugError) {
          return sendDatabaseError(
            res,
            slugError,
            "Unable to verify product slug."
          );
        }

        if (slugProduct) {
          return res.status(409).json({
            success: false,
            message:
              "A product with this slug already exists.",
          });
        }
      }

      /* ---------------------------------------------------
         UPDATE
      --------------------------------------------------- */

      const {
        data,
        error,
      } = await req.supabase
        .from("products")
        .update(payload)
        .eq(
          "id",
          productId
        )
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        return sendDatabaseError(
          res,
          error,
          "Unable to update product."
        );
      }

      return res.json({
        success: true,
        message:
          "Product updated successfully.",
        product: data,
      });
    } catch (error) {
      console.error(
        "UPDATE PRODUCT ERROR:",
        {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        }
      );

      next(error);
    }
  }
);

/* =========================================================
   ADMIN — DELETE PRODUCT
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const productId =
        req.params.id;

      const {
        data: existingProduct,
        error: existingError,
      } = await req.supabase
        .from("products")
        .select("id")
        .eq(
          "id",
          productId
        )
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found.",
        });
      }

      const {
        error,
      } = await req.supabase
        .from("products")
        .delete()
        .eq(
          "id",
          productId
        );

      if (error) {
        return sendDatabaseError(
          res,
          error,
          "Unable to delete product."
        );
      }

      return res.json({
        success: true,
        message:
          "Product deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE PRODUCT ERROR:",
        {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        }
      );

      next(error);
    }
  }
);

/* =========================================================
   PUBLIC — SINGLE PRODUCT
========================================================= */

router.get(
  "/:slug",
  async (req, res, next) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          sale_price,
          sku,
          category_id,
          badge,
          images,
          features,
          specifications,
          stock,
          rating,
          review_count,
          featured,
          is_active,
          sort_order,
          created_at,
          updated_at
        `)
        .eq(
          "slug",
          req.params.slug
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found.",
        });
      }

      return res.json({
        success: true,
        product: data,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;