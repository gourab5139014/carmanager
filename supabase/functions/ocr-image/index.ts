import app from '../../../src/app.ts';

/**
 * Supabase Edge Function entry point.
 * This file is a tiny wrapper that serves the portable Hono app.
 */
Deno.serve(app.fetch);
