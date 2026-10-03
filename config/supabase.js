const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL is missing from .env"
  );
}

if (!publishableKey) {
  throw new Error(
    "SUPABASE_PUBLISHABLE_KEY is missing from .env"
  );
}

if (!secretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY is missing from .env"
  );
}


/* =========================================================
   PUBLIC CLIENT
========================================================= */

const supabase = createClient(
  supabaseUrl,
  publishableKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);


/* =========================================================
   SERVER CLIENT
   BACKEND ONLY
========================================================= */

const supabaseAdmin = createClient(
  supabaseUrl,
  secretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);


/* =========================================================
   USER CLIENT
========================================================= */

function createUserClient(accessToken) {
  return createClient(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },

      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    }
  );
}


module.exports = {
  supabase,
  supabaseAdmin,
  createUserClient
};