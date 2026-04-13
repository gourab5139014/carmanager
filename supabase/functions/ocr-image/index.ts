import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  let type: string | undefined;
  try {
    let image: string, mediaType: string;
    ({ image, mediaType, type } = await req.json());
    // type: 'odometer' | 'pump'
    // image: base64-encoded JPEG/PNG
    // mediaType: 'image/jpeg' | 'image/png' | 'image/webp'

    const prompt = type === 'odometer'
      ? `Look at this odometer image. Extract the total mileage reading.
         Return ONLY valid JSON, no prose:
         {"odometer": <integer miles>}
         If the reading is unclear, return {"odometer": null, "error": "brief reason"}.`
      : `Look at this fuel pump display. Extract:
         - Gallons dispensed (volume)
         - Price per gallon
         - Total dollar amount charged
         Return ONLY valid JSON, no prose:
         {"volume_gal": <number>, "price_per_gal": <number>, "total_cost": <number>}
         Use null for any value you cannot read clearly.`;

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType ?? 'image/jpeg', data: image },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = (msg.content[0] as { text: string }).text;
    const match = raw.match(/\{[\s\S]*\}/);
    let result: Record<string, unknown>;
    try {
      result = match ? JSON.parse(match[0]) : { error: 'No JSON in response' };
    } catch {
      result = { error: 'JSON parse failed', raw };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Return a graceful null result rather than a 500 — lets the UI show
    // "unclear, enter manually" instead of a hard error.
    const msg = String(err);
    const nullResult = type === 'odometer'
      ? { odometer: null, error: msg }
      : { volume_gal: null, price_per_gal: null, total_cost: null, error: msg };
    return new Response(JSON.stringify(nullResult), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
