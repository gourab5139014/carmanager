import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js';
import { runOcr } from './ocr-service.ts';

/**
 * Multi-Tenant Car Manager Unified API (v2.0)
 */
const DB_SCHEMA = 'dev';
const app = new Hono().basePath('/ocr-image');

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
 * Middleware: Require a Bearer token on any route that invokes the Anthropic API.
 * The actual JWT validation happens via Supabase RLS; this guard prevents
 * unauthenticated callers from burning API quota.
 */
const requireAuth = async (c: any, next: any) => {
  if (!c.req.header('Authorization')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

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
      .schema(DB_SCHEMA)
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
 * POST /v1/vehicles
 * Create a new vehicle.
 */
app.post('/v1/vehicles', async (c) => {
  try {
    const sb = getSupabase(c);
    const body = await c.req.json();

    // Auth check implicitly handled by RLS if user_id is set
    // But we need to make sure we are not trying to override it

    const { name, make, model, year, active } = body;

    if (!name) throw new Error('Vehicle name is required');

    const { data, error } = await sb
      .schema(DB_SCHEMA)
      .from('vehicles')
      .insert({ name, make, model, year, active: active !== undefined ? active : true })
      .select()
      .single();

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
    let query = sb.schema('dev').from('refuelings').select('*').order('date', { ascending: false });
    
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
 * GET /v1/services
 * List services, optionally filtered by vehicle_id.
 */
app.get('/v1/services', async (c) => {
  const vehicleId = c.req.query('vehicle_id');
  try {
    const sb = getSupabase(c);
    let query = sb.schema(DB_SCHEMA).from('services').select('*').order('date', { ascending: false });
    
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
 * GET /v1/expenses
 * List expenses, optionally filtered by vehicle_id.
 */
app.get('/v1/expenses', async (c) => {
  const vehicleId = c.req.query('vehicle_id');
  try {
    const sb = getSupabase(c);
    let query = sb.schema(DB_SCHEMA).from('expenses').select('*').order('date', { ascending: false });
    
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
app.post('/v1/ocr', requireAuth, async (c) => {
  let type: string | undefined;
  try {
    const body = await c.req.json();
    type = body.type;
    const { image, mediaType } = body;
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
    // Always return 200 with null fields — UI shows "enter manually", never crashes
    return c.json(
      type === 'odometer'
        ? { odometer: null, error: err.message }
        : { volume_gal: null, price_per_gal: null, total_cost: null, error: err.message }
    );
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
    const items = Array.isArray(body) ? body : [body];
    
    // Auth check for vehicles
    const vehicleIds = [...new Set(items.map(i => i.vehicle_id))];
    for (const vid of vehicleIds) {
      if (!vid) throw new Error('vehicle_id is required');
      const { data: vehicle, error: vehicleErr } = await sb
        .schema(DB_SCHEMA)
        .from('vehicles')
        .select('id')
        .eq('id', vid)
        .single();
      if (vehicleErr || !vehicle) throw new Error('vehicle not found or access denied');
    }

    const results = [];
    for (const item of items) {
      const { 
        date, odometer, volume_gal, price_per_gal, 
        total_cost, fuel_type, full_tank, notes, vehicle_id 
      } = item;

      if (odometer === undefined || odometer === null) throw new Error('odometer is required');

      let distance_mi = null;
      const { data: prevFills } = await sb
        .schema(DB_SCHEMA)
        .from('refuelings')
        .select('odometer')
        .eq('vehicle_id', vehicle_id)
        .lt('odometer', odometer)
        .order('odometer', { ascending: false })
        .limit(1);

      if (prevFills && prevFills.length > 0) {
        distance_mi = odometer - prevFills[0].odometer;
      }

      const { data, error } = await sb.schema(DB_SCHEMA).from('refuelings').insert({
        date, odometer, volume_gal, price_per_gal, 
        total_cost, fuel_type, full_tank, notes, 
        vehicle_id, distance_mi
      }).select().single();

      if (error) throw error;
      results.push(data);
    }
    return c.json(Array.isArray(body) ? results : results[0]);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post('/v1/services', async (c) => {
  try {
    const sb = getSupabase(c);
    const body = await c.req.json();
    const items = Array.isArray(body) ? body : [body];
    
    const vehicleIds = [...new Set(items.map(i => i.vehicle_id))];
    for (const vid of vehicleIds) {
      if (!vid) throw new Error('vehicle_id is required');
      const { data: vehicle, error: vehicleErr } = await sb.schema(DB_SCHEMA).from('vehicles').select('id').eq('id', vid).single();
      if (vehicleErr || !vehicle) throw new Error('vehicle not found or access denied');
    }

    const { data, error } = await sb.schema(DB_SCHEMA).from('services').insert(items).select();
    if (error) throw error;
    return c.json(Array.isArray(body) ? data : data[0]);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post('/v1/expenses', async (c) => {
  try {
    const sb = getSupabase(c);
    const body = await c.req.json();
    const items = Array.isArray(body) ? body : [body];
    
    const vehicleIds = [...new Set(items.map(i => i.vehicle_id))];
    for (const vid of vehicleIds) {
      if (!vid) throw new Error('vehicle_id is required');
      const { data: vehicle, error: vehicleErr } = await sb.schema(DB_SCHEMA).from('vehicles').select('id').eq('id', vid).single();
      if (vehicleErr || !vehicle) throw new Error('vehicle not found or access denied');
    }

    const { data, error } = await sb.schema(DB_SCHEMA).from('expenses').insert(items).select();
    if (error) throw error;
    return c.json(Array.isArray(body) ? data : data[0]);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Backward compatibility: maintain the old POST route for now
app.post('*', requireAuth, async (c) => {
  // If it starts with /v1, it should have been caught by specific routes
  if (c.req.path.startsWith('/v1/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  // Otherwise, fallback to the old OCR logic — preserve the 200+null error contract
  let type: string | undefined;
  try {
    const body = await c.req.json();
    type = body.type;
    const apiKey = c.env?.ANTHROPIC_API_KEY || Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');
    const result = await runOcr({
      image: body.image,
      mediaType: body.mediaType,
      type: body.type,
      apiKey,
    });
    return c.json(result);
  } catch (err: any) {
    // Always return 200 with null fields — UI shows "enter manually", never crashes
    return c.json(
      type === 'odometer'
        ? { odometer: null, error: err.message }
        : { volume_gal: null, price_per_gal: null, total_cost: null, error: err.message }
    );
  }
});

export default app;
