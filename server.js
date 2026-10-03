const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

/* =========================================================
   ROUTES
========================================================= */

const productsRoutes = require("./routes/products");
const categoriesRoutes = require("./routes/categories");
const ordersRoutes = require("./routes/orders");
const paymentsRoutes = require("./routes/payments");
const settingsRoutes = require("./routes/settings");
const shippingRoutes = require("./routes/shipping");
const usersRoutes = require("./routes/users");
const uploadsRoutes = require("./routes/uploads");

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = (
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // such as server-to-server requests and health checks.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin is not allowed by CORS.")
      );
    },

    credentials: true,
  })
);

/* =========================================================
   BODY PARSER
========================================================= */

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MT Luxor Backend is running.",
  });
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "MT Luxor API is healthy.",
    database: "Supabase",
  });
});

/* =========================================================
   PRODUCT ROUTES
========================================================= */

app.use(
  "/api/products",
  productsRoutes
);

/* =========================================================
   CATEGORY ROUTES
========================================================= */

app.use(
  "/api/categories",
  categoriesRoutes
);

/* =========================================================
   ORDER ROUTES
========================================================= */

app.use(
  "/api/orders",
  ordersRoutes
);

/* =========================================================
   PAYMENT ROUTES
========================================================= */

app.use(
  "/api/payments",
  paymentsRoutes
);

/* =========================================================
   STORE SETTINGS ROUTES
========================================================= */

app.use(
  "/api/settings",
  settingsRoutes
);

/* =========================================================
   SHIPPING ROUTES
========================================================= */

app.use(
  "/api/shipping",
  shippingRoutes
);

/* =========================================================
   USER / CUSTOMER ROUTES
========================================================= */

app.use(
  "/api/users",
  usersRoutes
);

/* =========================================================
   IMAGE UPLOAD ROUTES
========================================================= */

app.use(
  "/api/uploads",
  uploadsRoutes
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("");
  console.error("========================================");
  console.error(" SERVER ERROR");
  console.error("========================================");
  console.error(error);
  console.error("========================================");
  console.error("");

  res.status(error.status || 500).json({
    success: false,
    message:
      error.message ||
      "Something went wrong on the server.",
  });
});

/* =========================================================
   LOCAL DEVELOPMENT SERVER
========================================================= */

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log("");
    console.log("========================================");
    console.log(" MT LUXOR BACKEND");
    console.log("========================================");

    console.log(
      ` Server: http://localhost:${PORT}`
    );

    console.log(
      ` Health: http://localhost:${PORT}/api/health`
    );

    console.log(
      ` Products: http://localhost:${PORT}/api/products`
    );

    console.log(
      ` Categories: http://localhost:${PORT}/api/categories`
    );

    console.log(
      ` Orders: http://localhost:${PORT}/api/orders`
    );

    console.log(
      ` Payments: http://localhost:${PORT}/api/payments`
    );

    console.log(
      ` Settings: http://localhost:${PORT}/api/settings`
    );

    console.log(
      ` Shipping: http://localhost:${PORT}/api/shipping`
    );

    console.log(
      ` Users: http://localhost:${PORT}/api/users`
    );

    console.log(
      ` Uploads: http://localhost:${PORT}/api/uploads`
    );

    console.log(
      ` Allowed Origins: ${allowedOrigins.join(", ")}`
    );

    console.log(" Database: Supabase");

    console.log("========================================");
    console.log("");
  });
}

/* =========================================================
   VERCEL / EXPRESS EXPORT
========================================================= */

module.exports = app;