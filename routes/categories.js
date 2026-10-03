const express = require("express");

const router = express.Router();

const { supabase } = require("../config/supabase");
const {
  requireAuth,
  requireAdmin
} = require("../middleware/auth");


/* =========================================================
   GET ACTIVE CATEGORIES
   Public Store
========================================================= */

router.get("/", async (req, res, next) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("categories")
      .select(`
        id,
        name,
        slug,
        description,
        image_url,
        is_active,
        created_at,
        updated_at
      `)
      .eq("is_active", true)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      categories: data || []
    });
  } catch (error) {
    next(error);
  }
});


/* =========================================================
   GET ALL CATEGORIES
   Admin
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
        .from("categories")
        .select("*")
        .order("created_at", {
          ascending: false
        });

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        categories: data || []
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   GET SINGLE CATEGORY
   Public
========================================================= */

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      data,
      error
    } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Category not found."
      });
    }

    res.json({
      success: true,
      category: data
    });
  } catch (error) {
    next(error);
  }
});


/* =========================================================
   CREATE CATEGORY
   Admin
========================================================= */

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        name,
        slug,
        description,
        image_url,
        is_active
      } = req.body;


      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name is required."
        });
      }


      if (!slug || !slug.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category slug is required."
        });
      }


      const payload = {
        name: name.trim(),

        slug: slug.trim(),

        description:
          description?.trim() || null,

        image_url:
          image_url || null,

        is_active:
          is_active === undefined
            ? true
            : Boolean(is_active)
      };


      const {
        data,
        error
      } = await req.supabase
        .from("categories")
        .insert(payload)
        .select("*")
        .single();


      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            message:
              "A category with this slug already exists."
          });
        }

        throw error;
      }


      res.status(201).json({
        success: true,
        message: "Category created successfully.",
        category: data
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   UPDATE CATEGORY
   Admin
========================================================= */

router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const {
        name,
        slug,
        description,
        image_url,
        is_active
      } = req.body;


      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name is required."
        });
      }


      if (!slug || !slug.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category slug is required."
        });
      }


      const payload = {
        name: name.trim(),

        slug: slug.trim(),

        description:
          description?.trim() || null,

        image_url:
          image_url || null,

        is_active:
          is_active === undefined
            ? true
            : Boolean(is_active),

        updated_at:
          new Date().toISOString()
      };


      const {
        data,
        error
      } = await req.supabase
        .from("categories")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();


      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            message:
              "A category with this slug already exists."
          });
        }

        throw error;
      }


      res.json({
        success: true,
        message: "Category updated successfully.",
        category: data
      });
    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   DELETE CATEGORY
   Admin
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;


      const {
        data: category,
        error: findError
      } = await req.supabase
        .from("categories")
        .select("id")
        .eq("id", id)
        .maybeSingle();


      if (findError) {
        throw findError;
      }


      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found."
        });
      }


      const {
        error: deleteError
      } = await req.supabase
        .from("categories")
        .delete()
        .eq("id", id);


      if (deleteError) {
        throw deleteError;
      }


      res.json({
        success: true,
        message: "Category deleted successfully."
      });
    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;