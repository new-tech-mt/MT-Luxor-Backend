const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const {
  requireAuth,
  requireAdmin
} = require("../middleware/auth");

const router = express.Router();


/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};


/* =========================================================
   MULTER
========================================================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE
  },

  fileFilter: (req, file, callback) => {
    if (
      !ALLOWED_MIME_TYPES[
        file.mimetype
      ]
    ) {
      return callback(
        new Error(
          "Only JPG, PNG and WEBP images are allowed."
        )
      );
    }

    callback(null, true);
  }
});


/* =========================================================
   CREATE SAFE FILE NAME
========================================================= */

function createFileName(mimeType) {
  const extension =
    ALLOWED_MIME_TYPES[mimeType];

  const randomName =
    crypto.randomBytes(16).toString("hex");

  return `${Date.now()}-${randomName}.${extension}`;
}


/* =========================================================
   UPLOAD HELPER
========================================================= */

async function uploadToStorage(
  req,
  file,
  bucket,
  folder
) {
  if (!file) {
    const error = new Error(
      "Image file is required."
    );

    error.status = 400;

    throw error;
  }


  const fileName =
    createFileName(file.mimetype);

  const filePath =
    `${folder}/${fileName}`;


  const {
    error: uploadError
  } = await req.supabase.storage
    .from(bucket)
    .upload(
      filePath,
      file.buffer,
      {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false
      }
    );


  if (uploadError) {
    console.error(
      "Supabase storage upload error:",
      uploadError
    );

    const error = new Error(
      uploadError.message ||
      "Image upload failed."
    );

    error.status = 500;

    throw error;
  }


  const {
    data: publicUrlData
  } = req.supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);


  if (
    !publicUrlData ||
    !publicUrlData.publicUrl
  ) {
    const error = new Error(
      "Unable to generate image URL."
    );

    error.status = 500;

    throw error;
  }


  return {
    bucket,
    path: filePath,
    url: publicUrlData.publicUrl,
    file_name: fileName,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size: file.size
  };
}


/* =========================================================
   PRODUCT IMAGE
   POST /api/uploads/products
========================================================= */

router.post(
  "/products",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const image =
        await uploadToStorage(
          req,
          req.file,
          "products",
          "products"
        );


      res.status(201).json({
        success: true,
        message:
          "Product image uploaded successfully.",
        image
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   CATEGORY IMAGE
   POST /api/uploads/categories
========================================================= */

router.post(
  "/categories",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const image =
        await uploadToStorage(
          req,
          req.file,
          "categories",
          "categories"
        );


      res.status(201).json({
        success: true,
        message:
          "Category image uploaded successfully.",
        image
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   BRANDING IMAGE
   POST /api/uploads/branding
========================================================= */

router.post(
  "/branding",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const image =
        await uploadToStorage(
          req,
          req.file,
          "branding",
          "branding"
        );


      res.status(201).json({
        success: true,
        message:
          "Branding image uploaded successfully.",
        image
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   DELETE IMAGE
   DELETE /api/uploads
========================================================= */

router.delete(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        bucket,
        path
      } = req.body;


      if (!bucket || !path) {
        return res.status(400).json({
          success: false,
          message:
            "Bucket and image path are required."
        });
      }


      const allowedBuckets = [
        "products",
        "categories",
        "branding"
      ];


      if (
        !allowedBuckets.includes(bucket)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid storage bucket."
        });
      }


      const allowedFolder =
        `${bucket}/`;


      if (
        !path.startsWith(allowedFolder)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid image path."
        });
      }


      const {
        error
      } = await req.supabase.storage
        .from(bucket)
        .remove([path]);


      if (error) {
        console.error(
          "Image deletion error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to delete image."
        });
      }


      res.json({
        success: true,
        message:
          "Image deleted successfully."
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

router.use(
  (error, req, res, next) => {
    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Image size must not exceed 5MB."
        });
      }


      return res.status(400).json({
        success: false,
        message: error.message
      });
    }


    if (
      error &&
      error.message ===
        "Only JPG, PNG and WEBP images are allowed."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }


    next(error);
  }
);


module.exports = router;