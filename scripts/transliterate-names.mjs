/**
 * Fills donors.hebrew_name / donors.latin_name for donors linked to Nedarim
 * standing orders, transliterating with Claude where a variant is missing.
 * Bilingual recovery emails use these to greet donors in the right script.
 *
 * Usage: node --env-file=.env.local scripts/transliterate-names.mjs
 */
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HEB = /[֐-׿]/;

async function transliterate(names, target) {
  const { content } = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content:
        `Transliterate these personal names to ${target === 'he' ? 'Hebrew script' : 'Latin script (standard English spelling as used in Jewish communities)'}. ` +
        `Return ONLY a JSON object mapping each input name to its transliteration. Keep first+last name order. Input:\n` +
        JSON.stringify(names),
    }],
  });
  const text = content[0].text.trim().replace(/^```(json)?|```$/g, '');
  return JSON.parse(text);
}

try {
  await client.connect();
  const { rows } = await client.query(`
    select distinct d.id, d.full_name, d.hebrew_name, d.latin_name
    from donors d
    join nedarim_keva k on k.donor_id = d.id
    where d.full_name is not null
      and (d.hebrew_name is null or d.latin_name is null)
  `);

  const needHe = rows.filter((r) => !r.hebrew_name && !HEB.test(r.full_name)); // Latin name → make Hebrew
  const needEn = rows.filter((r) => !r.latin_name && HEB.test(r.full_name));   // Hebrew name → make Latin
  // Names already in the right script just get copied into the variant column.
  const copyHe = rows.filter((r) => !r.hebrew_name && HEB.test(r.full_name));
  const copyEn = rows.filter((r) => !r.latin_name && !HEB.test(r.full_name));

  console.log(`to transliterate: ${needHe.length} → Hebrew, ${needEn.length} → Latin; direct copies: ${copyHe.length + copyEn.length}`);

  for (const r of copyHe) await client.query('update donors set hebrew_name=$1 where id=$2', [r.full_name, r.id]);
  for (const r of copyEn) await client.query('update donors set latin_name=$1 where id=$2', [r.full_name, r.id]);

  const chunk = (a, n) => a.reduce((out, x, i) => (i % n ? out[out.length - 1].push(x) : out.push([x]), out), []);
  for (const [list, target, col] of [[needHe, 'he', 'hebrew_name'], [needEn, 'en', 'latin_name']]) {
    for (const part of chunk(list, 80)) {
      const map = await transliterate(part.map((r) => r.full_name), target);
      for (const r of part) {
        const t = map[r.full_name];
        if (t) await client.query(`update donors set ${col}=$1 where id=$2`, [t, r.id]);
      }
      console.log(`updated ${part.length} × ${col}`);
    }
  }
  const { rows: check } = await client.query(`
    select count(*) filter (where hebrew_name is not null) he,
           count(*) filter (where latin_name is not null) en, count(*) total
    from donors d where exists (select 1 from nedarim_keva k where k.donor_id = d.id)
  `);
  console.log('done:', JSON.stringify(check[0]));
} finally {
  await client.end();
}
