const express = require("express");
const crypto = require("crypto");

const {
  supabaseAdmin,
} = require("../config/supabase");

const {
  requireAuth,
  requireAdmin,
} = require("../middleware/auth");

const router = express.Router();


/* =========================================================
   HELPERS
========================================================= */

function generateOrderNumber() {
  const timestamp = Date.now()
    .toString()
    .slice(-8);

  const random = crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase();

  return `MTL-${timestamp}-${random}`;
}


function normalizeString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const result = String(value).trim();

  return result === ""
    ? null
    : result;
}


function normalizePositiveInteger(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}


function getProductImage(product) {
  if (!product) {
    return null;
  }

  const images = product.images;

  if (Array.isArray(images)) {
    const firstImage = images[0];

    if (typeof firstImage === "string") {
      return firstImage;
    }

    if (
      firstImage &&
      typeof firstImage === "object"
    ) {
      return (
        firstImage.url ||
        firstImage.image_url ||
        null
      );
    }
  }

  if (typeof images === "string") {
    return images;
  }

  return null;
}


/* =========================================================
   CREATE ORDER
   PUBLIC GUEST CHECKOUT

   POST /api/orders
========================================================= */

router.post("/", async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_city,
      customer_notes,
      payment_method,
      items,
    } = req.body;


    /* =====================================================
       CUSTOMER INFORMATION
    ===================================================== */

    const customerName =
      normalizeString(customer_name);

    const customerPhone =
      normalizeString(customer_phone);

    const customerEmail =
      normalizeString(customer_email);

    const customerAddress =
      normalizeString(customer_address);

    const customerCity =
      normalizeString(customer_city);

    const customerNotes =
      normalizeString(customer_notes);

    const paymentMethod =
      normalizeString(payment_method);


    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }


    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required.",
      });
    }


    if (!customerAddress) {
      return res.status(400).json({
        success: false,
        message: "Customer address is required.",
      });
    }


    if (!customerCity) {
      return res.status(400).json({
        success: false,
        message: "Customer city is required.",
      });
    }


    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }


    /* =====================================================
       VALIDATE ITEMS
    ===================================================== */

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required.",
      });
    }


    if (items.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Too many products in one order.",
      });
    }


    const normalizedItems = [];


    for (const item of items) {
      const productId =
        normalizeString(item?.product_id);

      const quantity =
        normalizePositiveInteger(item?.quantity);


      if (!productId) {
        return res.status(400).json({
          success: false,
          message:
            "Every order item must have a product.",
        });
      }


      if (!quantity) {
        return res.status(400).json({
          success: false,
          message:
            "Every order item must have a valid quantity.",
        });
      }


      if (quantity > 100) {
        return res.status(400).json({
          success: false,
          message:
            "Maximum quantity for one product is 100.",
        });
      }


      normalizedItems.push({
        product_id: productId,
        quantity,
      });
    }


    /* =====================================================
       ADMIN DATABASE CLIENT

       Guest checkout has no login token.
       Secret key is used only on backend.
    ===================================================== */

    const db = supabaseAdmin;


    if (!db) {
      return res.status(500).json({
        success: false,
        message:
          "Server database client is not configured.",
      });
    }


    /* =====================================================
       CHECK PAYMENT METHOD
    ===================================================== */

    const {
      data: payment,
      error: paymentError,
    } = await db
      .from("payment_methods")
      .select(
        `
        id,
        method_key,
        method_name,
        is_enabled
        `
      )
      .eq(
        "method_key",
        paymentMethod
      )
      .maybeSingle();


    if (paymentError) {
      console.error(
        "Payment method verification error:",
        paymentError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify payment method.",
        details:
          paymentError.message || null,
      });
    }


    if (!payment) {
      return res.status(400).json({
        success: false,
        message:
          "Selected payment method does not exist.",
      });
    }


    if (payment.is_enabled !== true) {
      return res.status(400).json({
        success: false,
        message:
          "Selected payment method is currently unavailable.",
      });
    }


    /* =====================================================
       LOAD PRODUCTS
    ===================================================== */

    const productIds = [
      ...new Set(
        normalizedItems.map(
          (item) => item.product_id
        )
      ),
    ];


    const {
      data: products,
      error: productsError,
    } = await db
      .from("products")
      .select(
        `
        id,
        name,
        images,
        price,
        sale_price,
        stock,
        is_active
        `
      )
      .in(
        "id",
        productIds
      );


    if (productsError) {
      console.error(
        "Order products fetch error:",
        productsError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify products.",
        details:
          productsError.message || null,
      });
    }


    if (
      !products ||
      products.length !== productIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected products are no longer available.",
      });
    }


    /* =====================================================
       BUILD ORDER ITEMS
    ===================================================== */

    const orderItems = [];

    let subtotal = 0;


    for (const item of normalizedItems) {
      const product =
        products.find(
          (product) =>
            product.id === item.product_id
        );


      if (!product) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected products could not be found.",
        });
      }


      if (product.is_active !== true) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} is currently unavailable.`,
        });
      }


      const stock = Number(product.stock);


      if (
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} does not have valid stock information.`,
        });
      }


      if (stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message:
            `Only ${stock} unit(s) of ${product.name} are available.`,
        });
      }


      const regularPrice =
        Number(product.price);

      const salePrice =
        Number(product.sale_price);


      const actualPrice =
        salePrice > 0 &&
        salePrice < regularPrice
          ? salePrice
          : regularPrice;


      if (
        !Number.isFinite(actualPrice) ||
        actualPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} has an invalid price.`,
        });
      }


      const itemTotal =
        actualPrice * item.quantity;


      subtotal += itemTotal;


      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image:
          getProductImage(product),
        quantity: item.quantity,
        unit_price: actualPrice,
        total_price: itemTotal,
      });
    }


    /* =====================================================
       SHIPPING
    ===================================================== */

    const {
      data: shippingSettings,
      error: shippingError,
    } = await db
      .from("shipping_settings")
      .select(
        `
        delivery_charges,
        free_shipping_threshold,
        is_enabled
        `
      )
      .limit(1)
      .maybeSingle();


    if (shippingError) {
      console.error(
        "Shipping settings fetch error:",
        shippingError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load shipping settings.",
        details:
          shippingError.message || null,
      });
    }


    let shippingFee = 0;


    if (
      shippingSettings &&
      shippingSettings.is_enabled === true
    ) {
      const deliveryCharges =
        Number(
          shippingSettings.delivery_charges
        ) || 0;

      const freeShippingThreshold =
        Number(
          shippingSettings.free_shipping_threshold
        ) || 0;


      const qualifiesForFreeShipping =
        freeShippingThreshold > 0 &&
        subtotal >= freeShippingThreshold;


      if (qualifiesForFreeShipping) {
        shippingFee = 0;
      } else {
        shippingFee =
          Math.max(
            0,
            deliveryCharges
          );
      }
    }


    const total =
      subtotal + shippingFee;


    /* =====================================================
       CREATE ORDER
    ===================================================== */

    const orderNumber =
      generateOrderNumber();


    const {
      data: order,
      error: orderError,
    } = await db
      .from("orders")
      .insert({
        order_number: orderNumber,

        customer_id: null,

        customer_name: customerName,

        customer_phone: customerPhone,

        customer_email: customerEmail,

        customer_address: customerAddress,

        customer_city: customerCity,

        customer_notes: customerNotes,

        payment_method: paymentMethod,

        subtotal,

        shipping_fee: shippingFee,

        total,

        status: "pending",

        payment_status: "pending",
      })
      .select(
        `
        id,
        order_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        customer_city,
        customer_notes,
        payment_method,
        subtotal,
        shipping_fee,
        total,
        status,
        payment_status,
        created_at,
        updated_at
        `
      )
      .single();


    if (orderError) {
      console.error("");
      console.error(
        "========================================"
      );
      console.error(
        " ORDER CREATION ERROR"
      );
      console.error(
        "========================================"
      );
      console.error(
        orderError
      );
      console.error(
        "========================================"
      );
      console.error("");

      return res.status(500).json({
        success: false,
        message:
          "Unable to create order.",
        details:
          orderError.message || null,
        code:
          orderError.code || null,
        hint:
          orderError.hint || null,
      });
    }


    /* =====================================================
       CREATE ORDER ITEMS
    ===================================================== */

    const itemsWithOrderId =
      orderItems.map(
        (item) => ({
          order_id: order.id,
          ...item,
        })
      );


    const {
      data: createdItems,
      error: itemsError,
    } = await db
      .from("order_items")
      .insert(
        itemsWithOrderId
      )
      .select(
        `
        id,
        order_id,
        product_id,
        product_name,
        product_image,
        quantity,
        unit_price,
        total_price,
        created_at
        `
      );


    if (itemsError) {
      console.error(
        "Order items creation error:",
        itemsError
      );


      await db
        .from("orders")
        .delete()
        .eq(
          "id",
          order.id
        );


      return res.status(500).json({
        success: false,
        message:
          "Unable to create order items.",
        details:
          itemsError.message || null,
        code:
          itemsError.code || null,
      });
    }


    /* =====================================================
       REDUCE STOCK
    ===================================================== */

    for (const item of normalizedItems) {
      const product =
        products.find(
          (product) =>
            product.id ===
            item.product_id
        );


      if (!product) {
        continue;
      }


      const newStock =
        Number(product.stock) -
        item.quantity;


      const {
        error: stockError,
      } = await db
        .from("products")
        .update({
          stock: newStock,
        })
        .eq(
          "id",
          product.id
        )
        .eq(
          "stock",
          product.stock
        );


      if (stockError) {
        console.error(
          "Stock update error:",
          stockError
        );
      }
    }


    /* =====================================================
       SUCCESS
    ===================================================== */

    return res.status(201).json({
      success: true,

      message:
        "Order placed successfully.",

      order: {
        ...order,
        order_items:
          createdItems || [],
      },
    });

  } catch (error) {
    next(error);
  }
});


/* =========================================================
   ADMIN
   GET ALL ORDERS

   GET /api/orders
========================================================= */

router.get(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_id,
          customer_name,
          customer_phone,
          customer_email,
          customer_address,
          customer_city,
          customer_notes,
          payment_method,
          subtotal,
          shipping_fee,
          total,
          status,
          payment_status,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          `
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


      if (error) {
        console.error(
          "Admin orders fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load orders.",
          details:
            error.message || null,
        });
      }


      return res.json({
        success: true,
        orders: data || [],
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   CUSTOMER
   GET MY ORDERS

   GET /api/orders/my
========================================================= */

router.get(
  "/my",
  requireAuth,
  async (req, res, next) => {
    try {
      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_id,
          customer_name,
          customer_phone,
          customer_email,
          customer_address,
          customer_city,
          customer_notes,
          payment_method,
          subtotal,
          shipping_fee,
          total,
          status,
          payment_status,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          `
        )
        .eq(
          "customer_id",
          req.user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


      if (error) {
        console.error(
          "Customer orders fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load your orders.",
          details:
            error.message || null,
        });
      }


      return res.json({
        success: true,
        orders: data || [],
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   CUSTOMER
   GET MY SINGLE ORDER

   GET /api/orders/my/:id
========================================================= */

router.get(
  "/my/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const {
        id,
      } = req.params;


      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_id,
          customer_name,
          customer_phone,
          customer_email,
          customer_address,
          customer_city,
          customer_notes,
          payment_method,
          subtotal,
          shipping_fee,
          total,
          status,
          payment_status,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          `
        )
        .eq(
          "id",
          id
        )
        .eq(
          "customer_id",
          req.user.id
        )
        .maybeSingle();


      if (error) {
        console.error(
          "Customer order details error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load order.",
          details:
            error.message || null,
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }


      return res.json({
        success: true,
        order: data,
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   GET SINGLE ORDER

   GET /api/orders/:id
========================================================= */

router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id,
      } = req.params;


      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          customer_id,
          customer_name,
          customer_phone,
          customer_email,
          customer_address,
          customer_city,
          customer_notes,
          payment_method,
          subtotal,
          shipping_fee,
          total,
          status,
          payment_status,
          created_at,
          updated_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          `
        )
        .eq(
          "id",
          id
        )
        .maybeSingle();


      if (error) {
        console.error(
          "Admin order details error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to load order details.",
          details:
            error.message || null,
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }


      return res.json({
        success: true,
        order: data,
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   UPDATE ORDER STATUS

   PUT /api/orders/:id/status
========================================================= */

router.put(
  "/:id/status",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id,
      } = req.params;

      const {
        status,
      } = req.body;


      const allowedStatuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];


      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order status.",
        });
      }


      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .update({
          status,
        })
        .eq(
          "id",
          id
        )
        .select(
          `
          id,
          order_number,
          customer_name,
          status,
          payment_status,
          updated_at
          `
        )
        .maybeSingle();


      if (error) {
        console.error(
          "Order status update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to update order status.",
          details:
            error.message || null,
          code:
            error.code || null,
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }


      return res.json({
        success: true,
        message:
          "Order status updated successfully.",
        order: data,
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   ADMIN
   UPDATE PAYMENT STATUS

   PUT /api/orders/:id/payment-status
========================================================= */

router.put(
  "/:id/payment-status",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        id,
      } = req.params;

      const {
        payment_status,
      } = req.body;


      const allowedPaymentStatuses = [
        "pending",
        "paid",
        "failed",
        "refunded",
      ];


      if (
        !allowedPaymentStatuses.includes(
          payment_status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status.",
        });
      }


      const {
        data,
        error,
      } = await req.supabase
        .from("orders")
        .update({
          payment_status,
        })
        .eq(
          "id",
          id
        )
        .select(
          `
          id,
          order_number,
          customer_name,
          status,
          payment_status,
          updated_at
          `
        )
        .maybeSingle();


      if (error) {
        console.error(
          "Payment status update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to update payment status.",
          details:
            error.message || null,
          code:
            error.code || null,
        });
      }


      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }


      return res.json({
        success: true,
        message:
          "Payment status updated successfully.",
        order: data,
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