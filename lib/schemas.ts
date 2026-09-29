import { z } from "zod";

export const Category = z.enum([
  "water",
  "lift",
  "parking",
  "noise",
  "cleaning",
  "electrical",
  "security",
  "other",
]);

export const Urgency = z.enum(["critical", "high", "medium", "low"]);

export const Status = z.enum([
  "new",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

export const Role = z.enum(["resident", "committee", "admin"]);

export const Language = z.enum(["en", "hi", "hinglish"]);

/** Control characters are stripped before a complaint is stored. */
export const cleanText = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

const cleanString = (min: number, max: number) =>
  z
    .string()
    .transform(cleanText)
    .refine((v) => v.length >= min, `Must be at least ${min} characters`)
    .refine((v) => v.length <= max, `Must be at most ${max} characters`);

export const CreateComplaint = z
  .object({
    text: cleanString(3, 1000),
    flat_no: z.string().trim().max(10).optional(),
  })
  .strict();

export const PatchComplaint = z
  .object({
    status: Status.optional(),
    category: Category.optional(),
    urgency: Urgency.optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().max(120).optional(),
    cluster_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

const ImportRow = z.object({
  sender: z.string().trim().max(60),
  flat_no: z.string().trim().max(10).nullable(),
  text: cleanString(3, 1000),
});

export const ImportPreview = z
  .object({
    mode: z.literal("preview"),
    text: z.string().max(100_000),
  })
  .strict();

export const ImportCommit = z
  .object({
    mode: z.literal("commit"),
    rows: z.array(ImportRow).min(1).max(300),
  })
  .strict();

export const ImportRequest = z.discriminatedUnion("mode", [
  ImportPreview,
  ImportCommit,
]);

export const CreateComment = z
  .object({
    body: cleanString(1, 2000),
    is_internal: z.boolean().optional(),
  })
  .strict();

export const ReopenComplaint = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .optional();

export const UpdateMe = z
  .object({
    full_name: z.string().trim().min(1).max(80).optional(),
    flat_no: z.string().trim().max(10).optional(),
    phone: z.string().trim().max(20).optional(),
    preferred_lang: z.enum(["en", "hi"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const CreateInvite = z
  .object({
    email: z.string().trim().email().max(160),
    role: Role,
    flat_no: z.string().trim().max(10).optional(),
  })
  .strict();

export const UpdateMember = z
  .object({
    role: Role.optional(),
    flat_no: z.string().trim().max(10).optional(),
    full_name: z.string().trim().max(80).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const ResolveCluster = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const MergeCluster = z
  .object({
    into_cluster_id: z.string().uuid(),
  })
  .strict();

export const ListComplaintsQuery = z.object({
  status: Status.optional(),
  category: Category.optional(),
  urgency: Urgency.optional(),
  mine: z.enum(["0", "1"]).optional(),
  cluster_id: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** Shape of the object returned by the Claude triage tool. */
export const TriageResult = z.object({
  language: Language,
  title: z.string().trim().min(1).max(80),
  summary_en: z.string().trim().min(1).max(300),
  category: Category,
  urgency: Urgency,
  location: z.string().trim().max(60).nullable(),
  duplicate_of_id: z.string().uuid().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().max(160),
});

export type TriageResultInput = z.infer<typeof TriageResult>;
