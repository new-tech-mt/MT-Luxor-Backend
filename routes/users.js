const express = require("express");

const {
  requireAuth,
  requireAdmin
} = require("../middleware/auth");

const router = express.Router();


/* =========================================================
   GET ALL CUSTOMERS
   GET /api/users
========================================================= */

router.get(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await req.supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          phone,
          role,
          is_active,
          created_at,
          updated_at
          `
        )
        .eq("role", "customer")
        .order("created_at", {
          ascending: false
        });


      if (error) {
        console.error(
          "Customers fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load customers."
        });
      }


      res.json({
        success: true,
        customers: data || []
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   GET CUSTOMER DETAILS
   GET /api/users/:id
========================================================= */

router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id
      } = req.params;


      const {
        data: customer,
        error
      } = await req.supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          phone,
          role,
          is_active,
          created_at,
          updated_at
          `
        )
        .eq("id", id)
        .eq("role", "customer")
        .maybeSingle();


      if (error) {
        console.error(
          "Customer details error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load customer details."
        });
      }


      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found."
        });
      }


      res.json({
        success: true,
        customer
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   GET CUSTOMER ORDERS
   GET /api/users/:id/orders
========================================================= */

router.get(
  "/:id/orders",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id
      } = req.params;


      const {
        data: customer,
        error: customerError
      } = await req.supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", id)
        .eq("role", "customer")
        .maybeSingle();


      if (customerError) {
        console.error(
          "Customer verification error:",
          customerError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to verify customer."
        });
      }


      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found."
        });
      }


      const {
        data: orders,
        error: ordersError
      } = await req.supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_email,
          shipping_address,
          city,
          payment_method,
          subtotal,
          shipping_fee,
          total,
          status,
          payment_status,
          notes,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image_url,
            quantity,
            unit_price,
            total_price
          )
          `
        )
        .eq("customer_id", id)
        .order("created_at", {
          ascending: false
        });


      if (ordersError) {
        console.error(
          "Customer orders fetch error:",
          ordersError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load customer orders."
        });
      }


      res.json({
        success: true,
        customer,
        orders: orders || []
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   UPDATE CUSTOMER STATUS
   PUT /api/users/:id/status
========================================================= */

router.put(
  "/:id/status",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id
      } = req.params;

      const {
        is_active
      } = req.body;


      if (typeof is_active !== "boolean") {
        return res.status(400).json({
          success: false,
          message:
            "is_active must be true or false."
        });
      }


      const {
        data,
        error
      } = await req.supabase
        .from("profiles")
        .update({
          is_active
        })
        .eq("id", id)
        .eq("role", "customer")
        .select(
          `
          id,
          full_name,
          phone,
          role,
          is_active,
          created_at,
          updated_at
          `
        )
        .maybeSingle();


      if (error) {
        console.error(
          "Customer status update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to update customer status."
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Customer not found."
        });
      }


      res.json({
        success: true,
        message:
          "Customer status updated successfully.",
        customer: data
      });
    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;