import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { runOcr } from './ocr-service.ts';

/**
 * Portable Hono Application
 * This defines our API routes and logic independently of the host.
 */
const app = new Hono();

// Middleware: Standard Logger (stdout)
app.use('*', logger());

// Middleware: CORS (allowing the browser dashboard to talk to this)
app.use('*', cors({
  origin: '*',
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
  allowMethods: ['POST', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// Route: Health Check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Route: Core OCR Endpoint (handle any path as the function name might be in the URL)
app.post('*', async (c) => {
  let type: 'odometer' | 'pump' | undefined;
  
  try {
    const body = await c.req.json();
    type = body.type;
    const { image, mediaType } = body;
    
    // API key from the environment (Hono handles this cross-platform via c.env)
    // On Supabase/Deno, it uses Deno.env.get under the hood
    const apiKey = c.env?.ANTHROPIC_API_KEY || Deno.env.get('ANTHROPIC_API_KEY');

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is missing');
    }

    const result = await runOcr({
      image,
      mediaType,
      type: type as 'odometer' | 'pump',
      apiKey,
      logger: (msg, data) => {
        // Here we could also send logs to an external service like Axiom
        console.log(`[APP-LOG] ${msg}`, data || '');
      },
    });

    return c.json(result);
  } catch (err) {
    console.error(`[APP-ERROR]`, err);
    
    const msg = String(err);
    const nullResult = type === 'odometer'
      ? { odometer: null, error: msg }
      : { volume_gal: null, price_per_gal: null, total_cost: null, error: msg };
      
    return c.json(nullResult, 200); // UI expects 200 with error field
  }
});

export default app;
