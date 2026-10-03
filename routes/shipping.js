const express = require("express");

const {
  supabase
} = require("../config/supabase");

const {
  requireAuth,
  requireAdmin
} = require("../middleware/auth");

const router = express.Router();


/* =========================================================
   PUBLIC
   GET /api/shipping
========================================================= */

router.get(
  "/",
  async (req, res, next) => {
    try {

      const {
        data,
        error
      } = await supabase
        .from("shipping_settings")
        .select(
          `
          id,
          delivery_charges,
          free_shipping_threshold,
          is_enabled,
          created_at,
          updated_at
          `
        )
        .limit(1)
        .maybeSingle();


      if (error) {

        console.error(
          "Shipping settings fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load shipping settings."
        });
      }


      res.json({
        success: true,
        shipping: data || null
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   GET /api/shipping/admin
========================================================= */

router.get(
  "/admin",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {

      const {
        data,
        error
      } = await req.supabase
        .from("shipping_settings")
        .select(
          `
          id,
          delivery_charges,
          free_shipping_threshold,
          is_enabled,
          created_at,
          updated_at
          `
        )
        .limit(1)
        .maybeSingle();


      if (error) {

        console.error(
          "Admin shipping settings fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load shipping settings."
        });
      }


      res.json({
        success: true,
        shipping: data || null
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   SAVE SHIPPING SETTINGS
   PUT /api/shipping
========================================================= */

router.put(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {

      const {
        delivery_charges,
        free_shipping_threshold,
        is_enabled
      } = req.body;


      /* -----------------------------------------------------
         VALIDATE ENABLED STATUS
      ----------------------------------------------------- */

      if (
        is_enabled !== undefined &&
        typeof is_enabled !== "boolean"
      ) {

        return res.status(400).json({
          success: false,
          message:
            "is_enabled must be true or false."
        });
      }


      /* -----------------------------------------------------
         VALIDATE DELIVERY CHARGES
      ----------------------------------------------------- */

      let deliveryCharges =
        Number(delivery_charges);


      if (
        !Number.isFinite(deliveryCharges) ||
        deliveryCharges < 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Delivery charges must be a valid number greater than or equal to 0."
        });
      }


      /* -----------------------------------------------------
         VALIDATE FREE SHIPPING THRESHOLD
      ----------------------------------------------------- */

      let freeShippingThreshold =
        Number(free_shipping_threshold);


      if (
        !Number.isFinite(
          freeShippingThreshold
        ) ||
        freeShippingThreshold < 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Free shipping threshold must be a valid number greater than or equal to 0."
        });
      }


      /* -----------------------------------------------------
         PREPARE DATA
      ----------------------------------------------------- */

      const updateData = {
        delivery_charges:
          deliveryCharges,

        free_shipping_threshold:
          freeShippingThreshold,

        is_enabled:
          is_enabled !== undefined
            ? is_enabled
            : true
      };


      /* -----------------------------------------------------
         CHECK EXISTING ROW
      ----------------------------------------------------- */

      const {
        data: existing,
        error: existingError
      } = await req.supabase
        .from("shipping_settings")
        .select("id")
        .limit(1)
        .maybeSingle();


      if (existingError) {

        console.error(
          "Shipping settings lookup error:",
          existingError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to find shipping settings."
        });
      }


      /* -----------------------------------------------------
         CREATE OR UPDATE
      ----------------------------------------------------- */

      let data;
      let error;


      if (!existing) {

        const result =
          await req.supabase
            .from("shipping_settings")
            .insert(updateData)
            .select(
              `
              id,
              delivery_charges,
              free_shipping_threshold,
              is_enabled,
              created_at,
              updated_at
              `
            )
            .single();

        data = result.data;
        error = result.error;

      } else {

        const result =
          await req.supabase
            .from("shipping_settings")
            .update(updateData)
            .eq("id", existing.id)
            .select(
              `
              id,
              delivery_charges,
              free_shipping_threshold,
              is_enabled,
              created_at,
              updated_at
              `
            )
            .single();

        data = result.data;
        error = result.error;
      }


      /* -----------------------------------------------------
         DATABASE ERROR
      ----------------------------------------------------- */

      if (error) {

        console.error(
          "Shipping settings save error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message ||
            "Unable to save shipping settings.",
          details:
            error.details || null,
          code:
            error.code || null
        });
      }


      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      res.json({
        success: true,
        message:
          "Shipping settings saved successfully.",
        shipping: data
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;
