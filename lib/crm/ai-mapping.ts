import Anthropic from '@anthropic-ai/sdk';
import { DONOR_FIELDS, STUDENT_FIELDS } from './types';

export type ImportKind = 'donors' | 'students';

export interface AiMappingResult {
  mapping: Record<string, string | null>; // sourceColumn -> canonical field key | null (skip)
  defaultSegment: string | null; // donors only
  defaultLanguage: 'en' | 'he' | null;
  confidence: number; // 0..1
  notes: string;
}

const MODEL = process.env.CRM_AI_MODEL || 'claude-sonnet-4-6';

/**
 * Ask Claude to map a spreadsheet's columns onto our canonical CRM fields.
 * We only send the headers + a few sample rows — cheap and fast, and keeps
 * donor data minimal.
 */
export async function inferMapping(
  kind: ImportKind,
  headers: string[],
  sampleRows: Record<string, unknown>[]
): Promise<AiMappingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const client = new Anthropic({ apiKey });
  const fields = kind === 'students' ? STUDENT_FIELDS : DONOR_FIELDS;
  const fieldList = Object.entries(fields)
    .map(([k, desc]) => `  - ${k}: ${desc}`)
    .join('\n');

  const segmentNote =
    kind === 'donors'
      ? `\nAlso determine the donor SEGMENT. If a column indicates it, map that column to "segment". Otherwise infer a single defaultSegment for the whole file from the filename/columns/context, one of: monthly_regular, campaign_oneoff, campaign_monthly, other.`
      : '';

  const tool: Anthropic.Tool = {
    name: 'provide_mapping',
    description: 'Return the column-to-field mapping for this spreadsheet.',
    input_schema: {
      type: 'object',
      properties: {
        mapping: {
          type: 'object',
          description:
            'Object whose keys are the EXACT source column names and whose values are the canonical field key they map to, or null to skip the column.',
          additionalProperties: { type: ['string', 'null'] },
        },
        defaultSegment: {
          type: ['string', 'null'],
          enum: ['monthly_regular', 'campaign_oneoff', 'campaign_monthly', 'other', null],
        },
        defaultLanguage: { type: ['string', 'null'], enum: ['en', 'he', null] },
        confidence: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['mapping', 'confidence', 'notes'],
    },
  };

  const prompt = `You are importing a messy donor/student spreadsheet into a CRM. Map each source column to the best canonical field, or null if it doesn't fit any.

Canonical fields:
${fieldList}
${segmentNote}

Source columns:
${headers.map((h) => `  - "${h}"`).join('\n')}

Sample rows (JSON):
${JSON.stringify(sampleRows.slice(0, 6), null, 1)}

Rules:
- Keys in "mapping" must be the EXACT source column names listed above.
- Each canonical field should be used at most once. If two columns could map to the same field, pick the better one and null the other.
- Names: if there are separate first/last columns use those; if only one combined name column, map it to full_name.
- Money columns: map to total_pledged / total_paid / monthly_amount as appropriate.
- Be conservative: null is better than a wrong guess.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'provide_mapping' },
    messages: [{ role: 'user', content: prompt }],
  });

  const block = resp.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined;
  if (!block) throw new Error('AI did not return a mapping.');

  const input = block.input as Partial<AiMappingResult>;
  return {
    mapping: input.mapping ?? {},
    defaultSegment: input.defaultSegment ?? null,
    defaultLanguage: input.defaultLanguage ?? null,
    confidence: input.confidence ?? 0,
    notes: input.notes ?? '',
  };
}
