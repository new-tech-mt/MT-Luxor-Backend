const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const SITE_URL =
  process.env.SITE_URL ||
  "https://mtluxor.vercel.app";

/* =========================================================
   SUPABASE
========================================================= */

const {
  supabase,
} = require("./config/supabase");

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

const allowedOrigins = [
  "https://mtluxor.vercel.app",
  "https://mt-luxor-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    });
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // such as direct browser/API requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin
      );

      return callback(
        new Error(
          `CORS blocked origin: ${origin}`
        )
      );
    },

    credentials: true,
  })
);

/* =========================================================
   BODY PARSERS
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
   HELPERS
========================================================= */

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
   HEALTH / ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "MT Luxor Backend is running.",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "MT Luxor API is healthy.",
    database: "Supabase",
  });
});

/* =========================================================
   SEO — DYNAMIC SITEMAP
========================================================= */

app.get(
  "/sitemap.xml",
  async (req, res) => {
    try {
      const {
        data: products,
        error,
      } = await supabase
        .from("products")
        .select(
          "slug, updated_at, created_at"
        )
        .eq(
          "is_active",
          true
        )
        .not(
          "slug",
          "is",
          null
        );

      if (error) {
        console.error(
          "SITEMAP DATABASE ERROR:",
          error
        );

        return res
          .status(500)
          .type("text/plain")
          .send(
            "Unable to generate sitemap."
          );
      }

      const urls = [];

      /* ---------------------------------------------------
         HOMEPAGE
      --------------------------------------------------- */

      urls.push(`
  <url>
    <loc>${escapeXml(
      `${SITE_URL}/`
    )}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

      /* ---------------------------------------------------
         WATCHES PAGE
      --------------------------------------------------- */

      urls.push(`
  <url>
    <loc>${escapeXml(
      `${SITE_URL}/watches`
    )}</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);

      /* ---------------------------------------------------
         PRODUCT PAGES
      --------------------------------------------------- */

      for (const product of products || []) {
        if (!product?.slug) {
          continue;
        }

        const lastModified =
          product.updated_at ||
          product.created_at;

        urls.push(`
  <url>
    <loc>${escapeXml(
      `${SITE_URL}/product/${encodeURIComponent(
        product.slug
      )}`
    )}</loc>
    ${
      lastModified
        ? `<lastmod>${escapeXml(
            new Date(
              lastModified
            ).toISOString()
          )}</lastmod>`
        : ""
    }
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
      }

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls.join("\n")}
</urlset>`;

      res
        .status(200)
        .type("application/xml")
        .send(sitemap);
    } catch (error) {
      console.error(
        "SITEMAP ERROR:",
        error
      );

      return res
        .status(500)
        .type("text/plain")
        .send(
          "Unable to generate sitemap."
        );
    }
  }
);

/* =========================================================
   API ROUTES
========================================================= */

app.use(
  "/api/products",
  productsRoutes
);

app.use(
  "/api/categories",
  categoriesRoutes
);

app.use(
  "/api/orders",
  ordersRoutes
);

app.use(
  "/api/payments",
  paymentsRoutes
);

app.use(
  "/api/settings",
  settingsRoutes
);

app.use(
  "/api/shipping",
  shippingRoutes
);

app.use(
  "/api/users",
  usersRoutes
);

app.use(
  "/api/uploads",
  uploadsRoutes
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      "Route not found.",
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Server error:",
      error
    );

    res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Something went wrong on the server.",
    });
  }
);

/* =========================================================
   LOCAL DEVELOPMENT
========================================================= */

if (
  process.env.NODE_ENV !==
  "production"
) {
  app.listen(
    PORT,
    () => {
      console.log(
        "===================================="
      );

      console.log(
        "MT LUXOR BACKEND"
      );

      console.log(
        "===================================="
      );

      console.log(
        `Server: http://localhost:${PORT}`
      );

      console.log(
        `Health: http://localhost:${PORT}/api/health`
      );

      console.log(
        `Products: http://localhost:${PORT}/api/products`
      );

      console.log(
        `Categories: http://localhost:${PORT}/api/categories`
      );

      console.log(
        `Orders: http://localhost:${PORT}/api/orders`
      );

      console.log(
        `Payments: http://localhost:${PORT}/api/payments`
      );

      console.log(
        `Settings: http://localhost:${PORT}/api/settings`
      );

      console.log(
        `Shipping: http://localhost:${PORT}/api/shipping`
      );

      console.log(
        `Users: http://localhost:${PORT}/api/users`
      );

      console.log(
        `Uploads: http://localhost:${PORT}/api/uploads`
      );

      console.log(
        `Sitemap: http://localhost:${PORT}/sitemap.xml`
      );

      console.log(
        `Public Site: ${SITE_URL}`
      );

      console.log(
        `Allowed Origins: ${allowedOrigins.join(
          ", "
        )}`
      );

      console.log(
        "Database: Supabase"
      );

      console.log(
        "===================================="
      );
    }
  );
}

module.exports = app;