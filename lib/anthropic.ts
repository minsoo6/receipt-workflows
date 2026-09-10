import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedReceiptData } from './types';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey });
}

const EXTRACTION_PROMPT = `You are extracting structured data from a receipt image or PDF.
Return ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:

{
  "vendor": string or null,
  "date": string or null (ISO format YYYY-MM-DD if determinable),
  "amount": number or null (the final total paid, as a plain number, no currency symbol),
  "currency": string or null (ISO 4217 code like "USD" if determinable, else best guess symbol),
  "category": string or null (a short category like "Groceries", "Restaurant", "Travel", "Office Supplies", "Utilities", etc.),
  "summary": string or null (one short sentence summarizing the purchase),
  "items": [ { "description": string, "amount": number or null } ]
}

If a field cannot be determined, use null. Do not invent data that is not on the receipt.`;

function mimeToAnthropicMediaType(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'image/jpeg';
  if (mimeType === 'image/png') return 'image/png';
  if (mimeType === 'image/webp') return 'image/webp';
  if (mimeType === 'image/gif') return 'image/gif';
  return mimeType;
}

export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedReceiptData> {
  const client = getClient();
  const base64 = fileBuffer.toString('base64');

  const isPdf = mimeType === 'application/pdf';

  const content: Anthropic.MessageParam['content'] = [
    isPdf
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 }
        } as any)
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeToAnthropicMediaType(mimeType) as any,
            data: base64
          }
        },
    { type: 'text', text: EXTRACTION_PROMPT }
  ];

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content }]
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '{}';

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;

  try {
    const parsed = JSON.parse(jsonText);
    return {
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      currency: parsed.currency ?? null,
      category: parsed.category ?? null,
      summary: parsed.summary ?? null,
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch (err) {
    throw new Error(`Failed to parse extraction response as JSON: ${raw.slice(0, 300)}`);
  }
}
