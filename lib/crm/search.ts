// One search box for the whole CRM.
//
// Builds PostgREST `or(...)` groups from what the user typed, so the search
// runs in the database over ALL rows (not just the page on screen) using the
// existing columns — no schema change.
//
//  • Names: Hebrew, English or Latin spelling, first or last name, in any
//    order ("Cohen Moshe" finds "Moshe Cohen") — each word must match some
//    name/email/city field.
//  • Phones: any format. 052-123-4567, 0521234567 and +972 52 123 4567 all
//    find the same person, whichever way the number was stored.
//  • Email: any part of the address.

import { phoneKey } from './util';

export const DONOR_TEXT_FIELDS = [
  'full_name', 'first_name', 'last_name', 'hebrew_name', 'latin_name', 'email', 'city',
];
export const DONOR_PHONE_FIELDS = ['phone', 'whatsapp_phone'];

export const STUDENT_TEXT_FIELDS = [
  'full_name', 'first_name', 'last_name', 'hebrew_name',
  'parent_name', 'parent_email', 'parent2_name', 'parent2_email',
];
export const STUDENT_PHONE_FIELDS = ['parent_phone', 'parent_whatsapp', 'parent2_phone'];

// Characters that would break PostgREST's or() syntax or act as wildcards.
const clean = (s: string) => s.replace(/[,()"\\*%:]/g, ' ').trim();

// A phone pattern that ignores separators: 521234567 → %5%2%1%2%3%4%5%6%7%
function phonePattern(digits: string): string {
  const k = phoneKey(digits);
  if (k.length >= 5) return '%' + k.split('').join('%') + '%';
  return `%${k}%`;
}

const isPhoneLike = (s: string) => /^[\d\s+()\-./]+$/.test(s) && s.replace(/\D/g, '').length >= 3;

/**
 * Returns a list of or-filter strings. Apply each with `query = query.or(g)`;
 * PostgREST ANDs them together, so every word has to match somewhere.
 */
export function searchGroups(raw: string, textFields: string[], phoneFields: string[]): string[] {
  const q = (raw || '').trim();
  if (!q) return [];

  // The whole box is a phone number (may contain spaces) → one phone group.
  if (isPhoneLike(q)) {
    const pat = phonePattern(q);
    return [phoneFields.map((f) => `${f}.ilike.${pat}`).join(',')];
  }

  const words = clean(q).split(/\s+/).filter(Boolean);
  return words.map((word) => {
    if (isPhoneLike(word)) {
      const pat = phonePattern(word);
      // a number inside a mixed query may also be part of an email/name
      return [...phoneFields.map((f) => `${f}.ilike.${pat}`), ...textFields.map((f) => `${f}.ilike.%${word}%`)].join(',');
    }
    return textFields.map((f) => `${f}.ilike.%${word}%`).join(',');
  });
}

/** Apply the search to a supabase query builder. */
export function applySearch<T extends { or: (f: string) => T }>(
  query: T, raw: string, textFields: string[], phoneFields: string[]
): T {
  for (const g of searchGroups(raw, textFields, phoneFields)) query = query.or(g);
  return query;
}
