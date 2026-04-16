import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js';
import { runOcr } from './ocr-service.ts';

/**
 * Multi-Tenant Car Manager Unified API (v2.0)
 */
const app = new Hono();

// Middleware: Standard Logger
app.use('*', logger());

// Middleware: CORS
app.use('*', cors({
  origin: '*',
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

/**
 * Helper: Create Supabase client with user's JWT for RLS
 */
const getSupabase = (c: any) => {
  const url = c.env?.SUPABASE_URL || Deno.env.get('SUPABASE_URL');
  const anonKey = c.env?.SUPABASE_ANON_KEY || Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = c.req.header('Authorization');

  if (!url || !anonKey) {
    throw new Error('Supabase configuration missing');
  }

  // Create client with the user's JWT passed in the Authorization header
  // This allows RLS (Row Level Security) to work correctly.
  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
};

// Route: Health Check
app.get('/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

/**
 * GET /v1/vehicles
 * List all vehicles owned by the authenticated user.
 */
app.get('/v1/vehicles', async (c) => {
  try {
    const sb = getSupabase(c);
    const { data, error } = await sb
      .from('vehicles')
      .select('*')
      .order('name');

    if (error) throw error;
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * GET /v1/refuelings
 * List refuelings, optionally filtered by vehicle_id.
 */
app.get('/v1/refuelings', async (c) => {
  const vehicleId = c.req.query('vehicle_id');
  try {
    const sb = getSupabase(c);
    let query = sb.from('refuelings').select('*').order('date', { ascending: false });
    
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /v1/ocr
 * Standalone OCR route (legacy support)
 */
app.post('/v1/ocr', async (c) => {
  try {
    const body = await c.req.json();
    const { image, mediaType, type } = body;
    const apiKey = c.env?.ANTHROPIC_API_KEY || Deno.env.get('ANTHROPIC_API_KEY');

    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');

    const result = await runOcr({
      image,
      mediaType,
      type: type as 'odometer' | 'pump',
      apiKey,
    });

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /v1/refuelings
 * Unified log route: handles metadata, distance computation, and DB insert.
 */
app.post('/v1/refuelings', async (c) => {
  try {
    const sb = getSupabase(c);
    const body = await c.req.json();
    
    const { 
      date, odometer, volume_gal, price_per_gal, 
      total_cost, fuel_type, full_tank, notes, vehicle_id 
    } = body;

    if (!vehicle_id) throw new Error('vehicle_id is required');
    if (!odometer) throw new Error('odometer is required');

    // 1. Compute distance_mi from previous fill
    let distance_mi = null;
    const { data: prevFills } = await sb
      .from('refuelings')
      .select('odometer')
      .eq('vehicle_id', vehicle_id)
      .lt('odometer', odometer)
      .order('odometer', { ascending: false })
      .limit(1);

    if (prevFills && prevFills.length > 0) {
      distance_mi = odometer - prevFills[0].odometer;
    }

    // 2. Insert record
    const { data, error } = await sb.from('refuelings').insert({
      date, odometer, volume_gal, price_per_gal, 
      total_cost, fuel_type, full_tank, notes, 
      vehicle_id, distance_mi
    }).select().single();

    if (error) throw error;
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Backward compatibility: maintain the old POST route for now
app.post('*', async (c) => {
  // If it starts with /v1, it should have been caught by specific routes
  if (c.req.path.startsWith('/v1/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  // Otherwise, fallback to the old OCR logic
  try {
    const body = await c.req.json();
    const apiKey = c.env?.ANTHROPIC_API_KEY || Deno.env.get('ANTHROPIC_API_KEY');
    const result = await runOcr({
      image: body.image,
      mediaType: body.mediaType,
      type: body.type,
      apiKey: apiKey!,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
