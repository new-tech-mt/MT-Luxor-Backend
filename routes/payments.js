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
   GET /api/payments
========================================================= */

router.get("/", async (req, res, next) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("payment_methods")
      .select(
        `
        id,
        method_key,
        method_name,
        is_enabled,
        account_title,
        account_number,
        bank_name,
        iban,
        instructions
        `
      )
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error(
        "Payment methods fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load payment methods."
      });
    }

    res.json({
      success: true,
      payment_methods: data || []
    });
  } catch (error) {
    next(error);
  }
});


/* =========================================================
   ADMIN
   GET /api/payments/all
========================================================= */

router.get(
  "/all",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await req.supabase
        .from("payment_methods")
        .select("*")
        .order("created_at", {
          ascending: true
        });

      if (error) {
        console.error(
          "Admin payment methods fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        payment_methods: data || []
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   UPDATE PAYMENT METHOD
   PUT /api/payments/:id
========================================================= */

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id
      } = req.params;

      const {
        is_enabled,
        account_title,
        account_number,
        bank_name,
        iban,
        instructions
      } = req.body;

      const updateData = {};


      /* -----------------------------------------------------
         ENABLE / DISABLE
      ----------------------------------------------------- */

      if (is_enabled !== undefined) {
        if (typeof is_enabled !== "boolean") {
          return res.status(400).json({
            success: false,
            message:
              "is_enabled must be true or false."
          });
        }

        updateData.is_enabled = is_enabled;
      }


      /* -----------------------------------------------------
         ACCOUNT TITLE
      ----------------------------------------------------- */

      if (account_title !== undefined) {
        updateData.account_title =
          String(account_title).trim() || null;
      }


      /* -----------------------------------------------------
         ACCOUNT NUMBER
      ----------------------------------------------------- */

      if (account_number !== undefined) {
        updateData.account_number =
          String(account_number).trim() || null;
      }


      /* -----------------------------------------------------
         BANK NAME
      ----------------------------------------------------- */

      if (bank_name !== undefined) {
        updateData.bank_name =
          String(bank_name).trim() || null;
      }


      /* -----------------------------------------------------
         IBAN
      ----------------------------------------------------- */

      if (iban !== undefined) {
        updateData.iban =
          String(iban).trim() || null;
      }


      /* -----------------------------------------------------
         INSTRUCTIONS
      ----------------------------------------------------- */

      if (instructions !== undefined) {
        updateData.instructions =
          String(instructions).trim() || null;
      }


      if (
        Object.keys(updateData).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No payment information was provided."
        });
      }


      const {
        data,
        error
      } = await req.supabase
        .from("payment_methods")
        .update(updateData)
        .eq("id", id)
        .select(
          `
          id,
          method_key,
          method_name,
          is_enabled,
          account_title,
          account_number,
          bank_name,
          iban,
          instructions,
          created_at,
          updated_at
          `
        )
        .single();


      if (error) {
        console.error(
          "Payment update error:",
          error
        );

        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            message:
              "Payment method not found."
          });
        }

        return res.status(500).json({
          success: false,
          message: error.message
        });
      }


      res.json({
        success: true,
        message:
          "Payment method updated successfully.",
        payment_method: data
      });
    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;