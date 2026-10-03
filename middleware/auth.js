const {
  supabase,
  createUserClient
} = require("../config/supabase");


/* =========================================================
   REQUIRE AUTH
========================================================= */

async function requireAuth(req, res, next) {
  try {
    const authorization =
      req.headers.authorization || "";


    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }


    const token =
      authorization
        .replace("Bearer ", "")
        .trim();


    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing."
      });
    }


    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);


    if (error || !user) {
      console.error(
        "Authentication verification error:",
        error
      );

      return res.status(401).json({
        success: false,
        message:
          error?.message ||
          "Invalid or expired session.",
        code:
          error?.code || null
      });
    }


    req.user = user;

    req.supabase =
      createUserClient(token);


    next();

  } catch (error) {
    next(error);
  }
}


/* =========================================================
   REQUIRE ADMIN
========================================================= */

async function requireAdmin(req, res, next) {
  try {

    if (!req.user || !req.supabase) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }


    /* -----------------------------------------------
       IMPORTANT:
       profiles.phone does not exist.
       Only select columns that actually exist.
    ----------------------------------------------- */

    const {
      data: profile,
      error
    } = await req.supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        role,
        is_active
        `
      )
      .eq("id", req.user.id)
      .maybeSingle();


    if (error) {

      console.error(
        "========================================"
      );

      console.error(
        " ADMIN PROFILE VERIFICATION ERROR"
      );

      console.error(
        "========================================"
      );

      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Details:",
        error.details
      );

      console.error(
        "Hint:",
        error.hint
      );

      console.error(
        "Code:",
        error.code
      );

      console.error(
        "User ID:",
        req.user.id
      );

      console.error(
        "========================================"
      );


      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Unable to verify admin account.",
        details:
          error.details || null,
        hint:
          error.hint || null,
        code:
          error.code || null
      });
    }


    if (!profile) {
      return res.status(403).json({
        success: false,
        message:
          "Admin profile not found."
      });
    }


    if (
      profile.role !== "admin" ||
      profile.is_active !== true
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Admin access required."
      });
    }


    req.profile = profile;


    next();

  } catch (error) {
    next(error);
  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  requireAuth,
  requireAdmin
};