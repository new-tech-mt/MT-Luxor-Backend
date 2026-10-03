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
   ALLOWED SETTINGS
========================================================= */

const SETTINGS_FIELDS = [
  "phone",
  "whatsapp",
  "email",
  "address",
  "instagram_username",
  "tiktok_username"
];


/* =========================================================
   GET PUBLIC SETTINGS
   GET /api/settings
========================================================= */

router.get(
  "/",
  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await supabase
        .from("store_settings")
        .select(
          `
          id,
          phone,
          whatsapp,
          email,
          address,
          instagram_username,
          tiktok_username
          `
        )
        .limit(1)
        .maybeSingle();


      if (error) {
        console.error(
          "Store settings fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load store settings."
        });
      }


      res.json({
        success: true,
        settings: data || null
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   GET ADMIN SETTINGS
   GET /api/settings/admin
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
        .from("store_settings")
        .select(
          `
          id,
          phone,
          whatsapp,
          email,
          address,
          instagram_username,
          tiktok_username,
          created_at,
          updated_at
          `
        )
        .limit(1)
        .maybeSingle();


      if (error) {
        console.error(
          "Admin settings fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load store settings."
        });
      }


      res.json({
        success: true,
        settings: data || null
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   SAVE ADMIN SETTINGS
   PUT /api/settings
========================================================= */

router.put(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const updateData = {};


      /* -----------------------------------------------------
         ONLY ACCEPT ALLOWED FIELDS
      ----------------------------------------------------- */

      for (const field of SETTINGS_FIELDS) {
        if (req.body[field] !== undefined) {
          updateData[field] =
            normalizeValue(req.body[field]);
        }
      }


      /* -----------------------------------------------------
         VALIDATE REQUEST
      ----------------------------------------------------- */

      if (
        Object.keys(updateData).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No valid store settings were provided."
        });
      }


      /* -----------------------------------------------------
         CHECK EXISTING SETTINGS ROW
      ----------------------------------------------------- */

      const {
        data: existing,
        error: existingError
      } = await req.supabase
        .from("store_settings")
        .select("id")
        .limit(1)
        .maybeSingle();


      if (existingError) {
        console.error(
          "Settings lookup error:",
          existingError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to find store settings."
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
            .from("store_settings")
            .insert(updateData)
            .select(
              `
              id,
              phone,
              whatsapp,
              email,
              address,
              instagram_username,
              tiktok_username,
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
            .from("store_settings")
            .update(updateData)
            .eq("id", existing.id)
            .select(
              `
              id,
              phone,
              whatsapp,
              email,
              address,
              instagram_username,
              tiktok_username,
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
          "Store settings save error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message ||
            "Unable to save store settings.",
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
          "Store settings saved successfully.",
        settings: data
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   NORMALIZE VALUES
========================================================= */

function normalizeValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  if (typeof value === "string") {
    const trimmed =
      value.trim();

    return trimmed === ""
      ? null
      : trimmed;
  }


  return value;
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = router;