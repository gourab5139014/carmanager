import app from '../../../src/app.ts';
import { serveStatic } from 'npm:hono/deno';

/**
 * Supabase Edge Function entry point.
 * This file serves the portable Hono app and adds static asset hosting.
 */

// 1. Serve static assets from the bundled 'dist' directory
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }));
app.use('/sw.js', serveStatic({ path: './dist/sw.js' }));
app.use('/manifest.webmanifest', serveStatic({ path: './dist/manifest.webmanifest' }));

// 2. SPA Fallback: Any GET request that doesn't match an API route serves index.html
app.get('*', (c, next) => {
  const path = c.req.path;
  
  // Strict Exclusion: Do not serve HTML for any path that looks like an API call, 
  // documentation, or health check. This ensures correct 404 JSON/text responses.
  const isApiOrSystemPath = 
    path.startsWith('/v1/') || 
    path.startsWith('/docs') || 
    path.startsWith('/openapi.yaml') || 
    path.startsWith('/health');

  if (isApiOrSystemPath) {
    return next();
  }

  // Otherwise, serve the frontend SPA
  return serveStatic({ path: './dist/index.html' })(c, next);
});

Deno.serve(app.fetch);
