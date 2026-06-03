// Canonical CRM types — mirror the database schema in supabase/migrations.

export type DonorSegment =
  | 'monthly_regular'
  | 'campaign_oneoff'
  | 'campaign_monthly'
  | 'other';

export type DonorStatus = 'active' | 'lapsed' | 'inactive';
export type Language = 'en' | 'he';
export type IssueType =
  | 'unfulfilled_pledge'
  | 'lapsed'
  | 'failed_payment'
  | 'manual';
export type IssueStatus = 'open' | 'resolved' | 'snoozed';
export type Channel = 'email' | 'whatsapp';

export interface Donor {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  hebrew_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  segment: DonorSegment;
  source: string | null;
  preferred_language: Language;
  status: DonorStatus;
  tags: string[];
  notes: string | null;
  total_pledged: number;
  total_paid: number;
  balance: number;
  monthly_amount: number | null;
  currency: string;
  first_gift_at: string | null;
  last_gift_at: string | null;
  external_id: string | null;
  import_batch_id: string | null;
  raw: Record<string, unknown> | null;
}

export interface DonorIssue {
  id: string;
  created_at: string;
  updated_at: string;
  donor_id: string;
  type: IssueType;
  status: IssueStatus;
  amount: number | null;
  detail: string | null;
  detected_at: string;
  resolved_at: string | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel;
  language: Language;
  category: string;
  subject: string | null;
  body: string;
  is_default: boolean;
}

export interface Student {
  id: string;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  hebrew_name: string | null;
  date_of_birth: string | null;
  status: 'applicant' | 'enrolled' | 'alumni' | 'withdrawn';
  enrolled_on: string | null;
  withdrawn_on: string | null;
  class_shiur: string | null;
  grade: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  parent_whatsapp: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_email: string | null;
  monthly_tuition: number;
  currency: string;
  notes: string | null;
  external_id: string | null;
  raw: Record<string, unknown> | null;
}

export interface StudentPayment {
  id: string;
  student_id: string;
  period: string; // YYYY-MM-01
  amount_due: number;
  amount_paid: number;
  paid_on: string | null;
  status: 'paid' | 'partial' | 'unpaid' | 'waived';
  method: string | null;
  notes: string | null;
}

// ── The canonical fields the AI import maps spreadsheet columns onto ──
export const DONOR_FIELDS = {
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Full name (if not split)',
  hebrew_name: 'Hebrew name',
  email: 'Email address',
  phone: 'Phone number',
  whatsapp_phone: 'WhatsApp number (if separate)',
  address_line: 'Street address',
  city: 'City',
  state: 'State / region',
  postal_code: 'Zip / postal code',
  country: 'Country',
  segment: 'Segment (monthly_regular | campaign_oneoff | campaign_monthly | other)',
  source: 'Source / campaign name',
  preferred_language: 'Preferred language (en | he)',
  status: 'Status (active | lapsed | inactive)',
  total_pledged: 'Total amount pledged',
  total_paid: 'Total amount paid',
  monthly_amount: 'Monthly recurring amount',
  currency: 'Currency (e.g. USD, ILS)',
  first_gift_at: 'First gift date',
  last_gift_at: 'Last gift date',
  external_id: 'Donor ID from the spreadsheet',
  notes: 'Notes',
} as const;

export const STUDENT_FIELDS = {
  first_name: 'Student first name',
  last_name: 'Student last name',
  full_name: 'Student full name (if not split)',
  hebrew_name: 'Hebrew name',
  date_of_birth: 'Date of birth',
  status: 'Status (applicant | enrolled | alumni | withdrawn)',
  enrolled_on: 'Enrollment date',
  class_shiur: 'Class / shiur',
  grade: 'Grade',
  parent_name: 'Parent / guardian name',
  parent_phone: 'Parent phone',
  parent_email: 'Parent email',
  parent_whatsapp: 'Parent WhatsApp',
  parent2_name: 'Second parent name',
  parent2_phone: 'Second parent phone',
  parent2_email: 'Second parent email',
  monthly_tuition: 'Monthly tuition amount',
  currency: 'Currency',
  external_id: 'Student ID from the spreadsheet',
  notes: 'Notes',
} as const;

export type DonorFieldKey = keyof typeof DONOR_FIELDS;
export type StudentFieldKey = keyof typeof STUDENT_FIELDS;

export type ColumnMapping = Record<string, string | null>; // sourceColumn -> canonicalField | null(skip)
