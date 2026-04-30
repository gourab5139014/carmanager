import sys

def main():
    with open('src/app.ts', 'r') as f:
        content = f.read()

    vehicles_post = """
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
"""

    if "app.post('/v1/vehicles'" not in content:
        # Insert after GET /v1/vehicles
        target = "app.get('/v1/vehicles', async (c) => {"
        idx = content.find(target)
        end_idx = content.find("});", idx) + 3
        content = content[:end_idx] + "\n" + vehicles_post + content[end_idx:]
        with open('src/app.ts', 'w') as f:
            f.write(content)
        print("Updated src/app.ts")
if __name__ == '__main__':
    main()
