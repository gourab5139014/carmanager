// @ts-nocheck
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createClient } from '@supabase/supabase-js';

// Re-implement the app logic or import it if possible. 
// Since app.ts uses npm: imports, we'll create a Node-compatible version for testing.

const DB_SCHEMA = 'dev';
const app = new Hono().basePath('/ocr-image');

app.use('*', logger());
app.use('*', cors());

const getSupabase = (c: any) => {
  const url = process.env.SUPABASE_URL || 'http://mock';
  const anonKey = process.env.SUPABASE_ANON_KEY || 'mock';
  return createClient(url, anonKey);
};

app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/v1/vehicles', (c) => c.json([]));
app.get('/v1/refuelings', (c) => c.json([]));
app.get('/v1/services', (c) => c.json([]));
app.get('/v1/expenses', (c) => c.json([]));
app.post('/v1/ocr', (c) => c.json({}));
app.post('/v1/refuelings', (c) => c.json({}));
app.post('/v1/services', (c) => c.json({}));
app.post('/v1/expenses', (c) => c.json({}));

const port = Number(process.env.PORT) || 3001;
console.log(`[NODE-SERVER] Starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});
