import Anthropic from 'npm:@anthropic-ai/sdk';

export interface OcrResult {
  odometer?: number | null;
  volume_gal?: number | null;
  price_per_gal?: number | null;
  total_cost?: number | null;
  error?: string;
  raw?: string;
}

export interface OcrParams {
  image: string;
  mediaType: string;
  type: 'odometer' | 'pump';
  apiKey: string;
  logger?: (msg: string, data?: any) => void;
}

/**
 * Core business logic for OCR using Anthropic.
 * This function is portable and can run in any JS environment.
 */
export async function runOcr({ image, mediaType, type, apiKey, logger }: OcrParams): Promise<OcrResult> {
  const log = logger || ((msg) => console.log(`[OCR-SERVICE] ${msg}`));

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

  log(`Processing ${type}`, { mediaType, imageLength: image?.length });

  try {
    const client = new Anthropic({ apiKey });
    
    log('Calling Anthropic...');
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
    log('Anthropic raw response received', { raw });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return { error: 'No JSON in response', raw };
    }

    try {
      return JSON.parse(match[0]);
    } catch (e) {
      return { error: 'JSON parse failed', raw };
    }
  } catch (err) {
    log('Anthropic API error', { error: String(err) });
    throw err;
  }
}
