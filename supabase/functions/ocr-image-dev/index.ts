import app from '../../../src/app.ts';

/**
 * Supabase Edge Function entry point.
 * Pure REST API mode (Separated Architecture).
 */
Deno.serve(app.fetch);
