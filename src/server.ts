/**
 * Generic Node.js / Bun Server entry point.
 * This can be used to run the same OCR logic on AWS Lambda,
 * DigitalOcean, or your own home server.
 */
import { serve } from 'npm:@hono/node-server';
import app from './app.ts';

const port = Number(process.env.PORT) || 3000;

console.log(`[LOCAL-SERVER] Starting OCR server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});
