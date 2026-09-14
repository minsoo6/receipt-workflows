import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedReceiptData, ReceiptFields } from './types';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

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

const GUESS_PROMPT = `You are filling in one new row of a receipt-tracking spreadsheet.

Some columns were already filled by matching column names to known receipt fields.
Your job is ONLY the remaining columns listed under "COLUMNS TO FILL".

Use two sources of evidence:
1. The receipt's details.
2. The existing rows, which show how this particular sheet is filled in — its
   vocabulary, casing, date formats, units, and any recurring default values.

Rules:
- Match the existing rows' conventions exactly (e.g. if they say "Yes"/"No", don't write "true").
- If a column is derivable from the receipt (a month name, a quarter, a year), derive it.
- If the existing rows show the same constant in a column, reuse that constant.
- If you cannot tell from either source, return an empty string for that column.
  Never invent facts about the purchase that aren't supported.
- Do not fill columns that look like they're meant to be filled in later by a
  person (approvals, sign-offs, reimbursement status) unless the existing rows
  show a consistent default.

Return ONLY a JSON object mapping column letter to the string to write, e.g.
{"F": "No", "G": "August"}. No markdown fences, no commentary.`;

export async function guessColumnValues(opts: {
  headers: { columnLetter: string; header: string }[];
  sampleRows: string[][];
  columnsToFill: { columnLetter: string; header: string }[];
  fields: ReceiptFields;
}): Promise<Record<string, string>> {
  if (opts.columnsToFill.length === 0) return {};

  const client = getClient();

  const headerLine = opts.headers.map((h) => `${h.columnLetter}: ${h.header}`).join(' | ');
  const examples = opts.sampleRows.length
    ? opts.sampleRows.map((row, i) => `Row ${i + 1}: ${row.join(' | ')}`).join('\n')
    : '(no existing data rows)';

  const receiptSummary = [
    `vendor: ${opts.fields.vendor ?? '(unknown)'}`,
    `date: ${opts.fields.receiptDate ?? '(unknown)'}`,
    `amount: ${opts.fields.amount ?? '(unknown)'}`,
    `currency: ${opts.fields.currency ?? '(unknown)'}`,
    `category: ${opts.fields.category ?? '(unknown)'}`,
    `summary: ${opts.fields.summary ?? '(unknown)'}`,
    `original filename: ${opts.fields.filename}`
  ].join('\n');

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${GUESS_PROMPT}

COLUMNS (letter: header):
${headerLine}

EXISTING ROWS:
${examples}

THIS RECEIPT:
${receiptSummary}

COLUMNS TO FILL:
${opts.columnsToFill.map((c) => `${c.columnLetter}: ${c.header}`).join('\n')}`
      }
    ]
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const allowed = new Set(opts.columnsToFill.map((c) => c.columnLetter));
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      // Ignore anything outside the requested columns so a stray key can't
      // overwrite a column that was matched by name.
      if (allowed.has(key) && typeof value === 'string' && value.trim() !== '') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}
