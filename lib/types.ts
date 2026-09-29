export type Role = "resident" | "committee" | "admin";

export type Category =
  | "water"
  | "lift"
  | "parking"
  | "noise"
  | "cleaning"
  | "electrical"
  | "security"
  | "other";

export type Urgency = "critical" | "high" | "medium" | "low";

export type Status =
  | "new"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export type ComplaintSource = "web" | "import" | "whatsapp";

export type TriageStatus = "pending" | "done" | "failed";

export type Language = "en" | "hi" | "hinglish";

export interface Society {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  society_id: string;
  role: Role;
  full_name: string | null;
  flat_no: string | null;
  phone: string | null;
  preferred_lang: "en" | "hi";
  created_at: string;
}

export interface Complaint {
  id: string;
  ref_no: number;
  society_id: string;
  reporter_id: string | null;
  reporter_label: string | null;
  flat_no: string | null;
  source: ComplaintSource;
  source_hash: string | null;
  raw_text: string;
  language: Language | null;
  summary_en: string | null;
  title: string | null;
  category: Category;
  urgency: Urgency;
  status: Status;
  triage: TriageStatus;
  location: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  needs_review: boolean;
  cluster_id: string | null;
  assignee_id: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  created_at: string;
  updated_at: string;
}

export interface ComplaintEvent {
  id: string;
  complaint_id: string;
  actor_id: string | null;
  type:
    | "created"
    | "triaged"
    | "status_changed"
    | "assigned"
    | "category_changed"
    | "urgency_changed"
    | "clustered"
    | "reopened"
    | "override";
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ComplaintComment {
  id: string;
  complaint_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Cluster {
  id: string;
  society_id: string;
  title: string;
  category: Category;
  urgency: Urgency;
  canonical_complaint_id: string | null;
  created_at: string;
}

/** A complaint as returned by the API, with derived fields. */
export interface ComplaintDTO extends Complaint {
  cluster_count: number;
  assignee: { id: string; full_name: string | null } | null;
}

/** Trimmed shape the UI renders — residents receive a subset of the fields. */
export interface ComplaintView {
  id: string;
  ref_no: number;
  title: string | null;
  raw_text: string;
  summary_en: string | null;
  language: Language | null;
  category: Category;
  urgency: Urgency;
  status: Status;
  triage: TriageStatus;
  location: string | null;
  flat_no: string | null;
  reporter_label?: string | null;
  needs_review?: boolean;
  ai_confidence?: number | null;
  cluster_id: string | null;
  cluster_count: number;
  assignee_id: string | null;
  assignee: { id: string; full_name: string | null } | null;
  sla_due_at: string | null;
  created_at: string;
  reopened_count: number;
}

export interface TodayResponse {
  critical?: ComplaintView[];
  overdue?: ComplaintView[];
  needs_review?: ComplaintView[];
  mine: ComplaintView[];
  counts?: { critical: number; overdue: number; new: number; mine: number };
}

export interface MeResponse {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
  flat_no: string | null;
  phone: string | null;
  preferred_lang: "en" | "hi";
  society: { id: string; name: string };
}

export const CATEGORIES: Category[] = [
  "water",
  "lift",
  "parking",
  "noise",
  "cleaning",
  "electrical",
  "security",
  "other",
];

export const URGENCIES: Urgency[] = ["critical", "high", "medium", "low"];

export const STATUSES: Status[] = [
  "new",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
];

export const OPEN_STATUSES: Status[] = [
  "new",
  "triaged",
  "assigned",
  "in_progress",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  water: "Water",
  lift: "Lift",
  parking: "Parking",
  noise: "Noise",
  cleaning: "Cleaning",
  electrical: "Electrical",
  security: "Security",
  other: "Other",
};

export const CATEGORY_ICONS: Record<Category, string> = {
  water: "💧",
  lift: "🛗",
  parking: "🚗",
  noise: "🔊",
  cleaning: "🧹",
  electrical: "⚡",
  security: "🛡️",
  other: "📌",
};

export const NEXT_STATUS_ACTION: Record<Status, string> = {
  new: "Assign to me",
  triaged: "Assign to me",
  assigned: "Start",
  in_progress: "Resolve",
  resolved: "Reopen",
  closed: "Closed",
};

export const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Resident",
  committee: "Committee",
  admin: "Admin",
};
