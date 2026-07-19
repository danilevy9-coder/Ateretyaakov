// ── Outreach treatment rules ─────────────────────────────────────────
// Who may be emailed automatically, how often, and how many times.
//
//   Master switch  crm_settings.outreach_mode: 'manual' | 'auto'
//     manual → automation NEVER sends; the admin selects donors on the
//              Recovery page and sends by hand. This is the default.
//     auto   → the daily sync follows the per-category rules below.
//
//   Per category   categories.outreach_policy: 'auto' | 'manual' | 'none'
//                  + followup_days + max_messages (cadence when 'auto')
//   No category    crm_settings.default_treatment (same shape)
//
// A donor in several categories gets the MOST PROTECTIVE combination:
// none > manual > auto; among auto rules, slowest cadence + lowest cap.
// If settings can't be read (e.g. migration not applied yet) everything
// falls back to manual — the safe direction is to send nothing.

import type { SupabaseClient } from '@supabase/supabase-js';

export type OutreachMode = 'manual' | 'auto';
export type OutreachPolicy = 'auto' | 'manual' | 'none';

export interface TreatmentRule {
  policy: OutreachPolicy;
  followup_days: number;
  max_messages: number;
}

export const FALLBACK_RULE: TreatmentRule = { policy: 'manual', followup_days: 7, max_messages: 3 };

export const POLICY_LABEL: Record<OutreachPolicy, string> = {
  auto: '🤖 Auto-email',
  manual: '✋ Manual only',
  none: '🚫 Do not email',
};

function normalizeRule(raw: Partial<TreatmentRule> | null | undefined): TreatmentRule {
  const policy: OutreachPolicy =
    raw?.policy === 'auto' || raw?.policy === 'none' ? raw.policy : 'manual';
  return {
    policy,
    followup_days: Math.max(1, Number(raw?.followup_days) || FALLBACK_RULE.followup_days),
    max_messages: Math.max(1, Number(raw?.max_messages) || FALLBACK_RULE.max_messages),
  };
}

// Most protective wins. Cadence numbers are combined even for manual/none
// so the UI can still show a sensible "N of M emails" counter.
export function combineRules(rules: TreatmentRule[], fallback: TreatmentRule): TreatmentRule {
  if (!rules.length) return fallback;
  const policy: OutreachPolicy = rules.some((r) => r.policy === 'none')
    ? 'none'
    : rules.some((r) => r.policy === 'manual')
      ? 'manual'
      : 'auto';
  return {
    policy,
    followup_days: Math.max(...rules.map((r) => r.followup_days)),
    max_messages: Math.min(...rules.map((r) => r.max_messages)),
  };
}

export interface OutreachConfig {
  mode: OutreachMode;
  defaultRule: TreatmentRule;
  ruleByCategory: Map<string, TreatmentRule>;
  categoryIdsByDonor: Map<string, string[]>;
}

export function ruleForDonor(cfg: OutreachConfig, donorId: string): TreatmentRule {
  const catIds = cfg.categoryIdsByDonor.get(donorId) ?? [];
  const rules = catIds
    .map((id) => cfg.ruleByCategory.get(id))
    .filter(Boolean) as TreatmentRule[];
  return combineRules(rules, cfg.defaultRule);
}

export async function loadOutreachConfig(
  supabase: SupabaseClient,
  donorIds: string[]
): Promise<OutreachConfig> {
  const cfg: OutreachConfig = {
    mode: 'manual',
    defaultRule: { ...FALLBACK_RULE },
    ruleByCategory: new Map(),
    categoryIdsByDonor: new Map(),
  };
  try {
    const { data: settings } = await supabase
      .from('crm_settings')
      .select('key, value')
      .in('key', ['outreach_mode', 'default_treatment']);
    for (const s of settings ?? []) {
      if (s.key === 'outreach_mode' && s.value === 'auto') cfg.mode = 'auto';
      if (s.key === 'default_treatment') cfg.defaultRule = normalizeRule(s.value);
    }

    const { data: cats } = await supabase
      .from('categories')
      .select('id, outreach_policy, followup_days, max_messages');
    for (const c of cats ?? []) {
      cfg.ruleByCategory.set(c.id, normalizeRule({
        policy: c.outreach_policy,
        followup_days: c.followup_days,
        max_messages: c.max_messages,
      }));
    }

    for (let i = 0; i < donorIds.length; i += 200) {
      const { data: links } = await supabase
        .from('donor_categories')
        .select('donor_id, category_id')
        .in('donor_id', donorIds.slice(i, i + 200));
      for (const l of links ?? []) {
        const arr = cfg.categoryIdsByDonor.get(l.donor_id) ?? [];
        arr.push(l.category_id);
        cfg.categoryIdsByDonor.set(l.donor_id, arr);
      }
    }
  } catch {
    // Settings unreadable → stay in manual mode (send nothing).
  }
  return cfg;
}
