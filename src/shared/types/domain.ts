/* The shapes the /v1 contract actually returns.

   Two absences are load-bearing and are enforced by the types themselves:
     - no field fuses Coverage and Mastery into one figure.
     - `mastery` is `number | null`, and it is null below the Evidence Floor —
       never 0, which would read as "answered nothing right" rather than "we
       have not asked". */

export type Band = "untested" | "early" | "firm_weak" | "firm_strong";

export type GradingMode = "ground_truth" | "text_grounded" | "model_judgment";

export type PaymentRoute = "credits" | "byok";

export interface Track {
  track_key: string;
  title: string;
  module_count?: number;
  topic_count?: number;
}

/** A Module the chosen scope shares material with.
 *
 *  Deliberately carries no figure about the Candidate — no Coverage, no
 *  Mastery, nothing that could be combined into one. Related Topics is a claim
 *  about the material, and the picker is where that claim cannot be misread as
 *  a claim about the person: nothing has been measured yet (ADR-0023). */
export interface TouchedModule {
  module_id: string;
  title: string;
  track_key: string;
  /** Already in the chosen scope. This is what tells a same-Module neighbour
   *  from a cross-Module one at this placement: covered, or sideways. */
  in_scope: boolean;
  edges: number;
  score: number;
  selectable: boolean;
}

/** Where a Candidate stands on **one** Topic of a shared Library.
 *
 *  Inside a Topic, Mastery means one thing and ordering it fuses nothing, so
 *  the number is available — and it is the only comparison that is. There is no
 *  overall position and no route that returns one (ADR-0022). */
export interface TopicStanding {
  topic_id: string;
  /** Null whenever the reading is unavailable, and `reason` always says which
   *  of the several reasons it is: below the Evidence Floor, below the Cohort
   *  Floor, or a Library nobody else holds. */
  rank: number | null;
  cohort: number;
  /** Others hold this same position because the mathematics cannot separate
   *  them — `#7= of 340` rather than `#7 of 340`. */
  shared: boolean;
  reason: string | null;
}

/** Coverage compared as Coverage. A second, separate reading, from a separate
 *  route, never combined with a Topic rank into a position. */
export interface CoverageStanding {
  topics_examined: number;
  topics_available: number;
  cohort: number;
  percentile: number | null;
  reason: string | null;
}

export interface Module {
  module_id: string;
  track_key: string;
  order: number;
  title: string;
  description: string;
  topic_count: number;
  ground_truth_topic_count: number;
  ceiling: GradingMode;
  /* A Module whose Source carried no retrievable text is listed and cannot be
     chosen. Hiding it would make Coverage a measure of what parsed. So is one
     that has not finished being read: a forty-second import that vanished from
     the picker would look like a document that never arrived. */
  selectable: boolean;
  stub_reason: string | null;
  state: SourceState;
  progress_done: number;
  progress_total: number;
}

export interface Scope {
  module_count: number;
  topic_count: number;
  ground_truth_topic_count: number;
  strongest_mode: GradingMode | null;
  /* Derived from Topic count alone, never from dossier length: "more text so
     it needs longer" is a difficulty reading wearing a clock's clothes. */
  suggested_seconds: number;
  minimum_seconds: number;
  questions_at_full_coverage: number;
  /* Deliberately absent: any difficulty figure, any estimate of cost — and a
     time is neither. */
}

export interface Citation {
  chunk_id: string;
  title: string;
  source_id: string;
  page: number | null;
  text: string;
  topic_id: string;
}

export interface TopicReading {
  topic_id: string;
  band: Band;
  label: string;
  coverage: number;
  mastery: number | null;
  interval: [number, number] | null;
  alpha: number;
  beta: number;
  title?: string;
}

/* Since ISSUE-0042 a turn carries the next question and nothing else. There is
   no `visit_closed`, no `last_visit` and no `close`: the Session is graded once,
   at the end, and the reading arrives in the report. */
export type TurnKind = "question" | "probe" | "hint";

export interface QuestionPayload {
  kind: TurnKind;
  question: string;
  opening_question: string;
  topic_visit_id: string;
  topic_id: string;
  topic_title: string;
  /** What the question actually spans. `topic_id` and `topic_title` stay
   *  beside these: ISSUE-0042 added to the payload rather than replacing it,
   *  and a compressed plan item spans up to three Topics. */
  topic_ids: string[];
  topic_titles: string[];
  /** Which fixed plan item is being executed. The rail highlights on this. */
  plan_item_id: string;
  grading_mode: GradingMode;
  turn: number;
}

export interface SessionEnded {
  session_id: string;
  reason: string;
}

export interface SessionParked {
  session_id: string;
  code: string;
  message: string;
  provider: string;
  recoverable: boolean;
}

export type TurnResult =
  | { kind: TurnKind; payload: QuestionPayload }
  | { kind: "session_ended"; payload: SessionEnded }
  | { kind: "session_parked"; payload: SessionParked };

/* No `candidate_id`: a Session is started by whoever presented the token. */
export interface StartSessionInput {
  module_ids: string[];
  duration_seconds: number;
  provider?: string;
  payment_route?: PaymentRoute | null;
}

/** What `POST /sessions/{id}/end` answers, in two shapes.
 *
 *  Ending is soft: a question still being asked finishes first, and that case
 *  carries a `note` rather than an outcome. Otherwise the Session is over —
 *  and *over* and *graded* are the same thing only when it ended. A Session
 *  parked for want of Credits is not graded, because topping up resumes it. */
export type EndResult =
  | { state: string; note: string; topic_visit_id: string }
  | { state: "ended" | "parked"; reason: string; graded: number };

/** One Session in the listing.
 *
 *  What happened, never how it went. There is no score, band or mastery here
 *  and there is not going to be one: a Session has no reading — Coverage and
 *  Mastery are two readings of one Topic, and a Session is not a Topic.
 *
 *  The three states are three different facts. `running` resumes; `ended` is
 *  graded and has a report; `parked` is waiting rather than finished, so it
 *  has not been graded and has nothing to report. */
export interface SessionListing {
  session_id: string;
  state: "running" | "parked" | "ended";
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  provider: string | null;
  payment_route: PaymentRoute;
  module_ids: string[];
  ended_reason: string | null;
  parked_reason: string | null;
  /** How many questions the plan fixed. Null where there is no plan — MCP
   *  Mode has none, and neither has anything older than the planner. A zero
   *  would read as a plan that asked nothing. */
  budget_questions: number | null;
  /** Position in that plan, not performance against it. */
  questions_asked: number;
  /** Evidence rows: Topics this Session measured. A count, never a score. */
  topics_measured: number;
}

export interface SessionVisit {
  topic_visit_id: string;
  topic_id: string;
  state: string;
  grading_mode: GradingMode | null;
  turn_count: number;
}

export interface SessionRecord {
  session_id: string;
  state: string;
  parked_reason: string | null;
  ended_reason: string | null;
  duration_seconds: number;
  provider: string | null;
  payment_route: PaymentRoute;
  visits: SessionVisit[];
  pending: QuestionPayload | null;
}

export interface Spend {
  route: PaymentRoute;
  /* BYOK and MCP carry null, never 0 — zero reads as "it was free". */
  credits: number | null;
  /* The planning call, on its own line. It is charged, and folding it into the
     Visits would hide a cost the Candidate paid before the first question. */
  planning: number | null;
  balance: number | null;
  per_visit: { topic_visit_id: string; topic_id: string; state: string; credits: number | null }[];
}

export interface CoverageReading {
  topics_examined: number;
  topics_total: number;
  effective_visits: number;
}

export interface MasteryReading {
  reportable_topics: number;
  looks_solid: number;
  looks_weak: number;
  early_signal: number;
}

export interface UntestedModule {
  module_id: string;
  title: string;
  topics_total: number;
  topics_untested: number;
  has_ground_truth: boolean;
}

export interface SessionSummary {
  session_id: string;
  duration_seconds: number;
  provider: string | null;
  topics_examined: number;
  ground_truth_visits: number;
  text_grounded_visits: number;
  model_judgment_visits: number;
  coverage: CoverageReading;
  mastery: MasteryReading;
  per_topic: (TopicReading & {
    title: string;
    module_title: string;
    graded_by: GradingMode | null;
    citations: Citation[];
  })[];
  untested_modules: UntestedModule[];
  /* `balance` is absent on BYOK rather than null — the key is not sent at
     all, and a Candidate on their own key has no Credit figure of any kind. */
  spend: {
    credits: number | null;
    planning: number | null;
    per_topic: number | null;
    balance?: number;
  };
}

/* -- The plan, fixed before the first question (ISSUE-0041) -------------- */

export type PlanItemState = "planned" | "asked" | "unreached";

/** `full` — every Topic gets its own question. `compressed` — the clock could
 *  not afford one each, so questions group Topics. Not a difficulty reading
 *  and not a shortfall: it is what the chosen duration bought. */
export type Breadth = "full" | "compressed";

export interface PlanTopic {
  topic_id: string;
  title: string;
  reached: boolean;
}

export interface PlanItem {
  plan_item_id: string;
  item_order: number;
  /** One line saying what a question spanning these Topics would test. Empty
   *  when the planner fell back to rule — a fallback plan is still a plan, and
   *  a surface that cannot render an empty focus renders nothing. */
  focus: string;
  state: PlanItemState;
  topic_ids: string[];
  topics: PlanTopic[];
}

/** The plan is fixed before the first question and the database refuses to
 *  update it. Nothing on the surface may reorder, add, remove or skip an item. */
export interface SessionPlan {
  session_id: string;
  budget_questions: number;
  suggested_seconds: number;
  chosen_seconds: number;
  breadth: Breadth;
  planner_provider: string | null;
  /** The model's plan was rejected and this one was built by rule. Always
   *  shown, never as an error: the plan is fixed and runs either way. */
  planner_fallback: boolean;
  items: PlanItem[];
}

/* -- What was said (ISSUE-0042). No score appears here. ------------------ */

export type MessageRole = "interviewer" | "candidate";
export type MessageKind = "question" | "answer" | "probe" | "hint";

export interface TranscriptMessage {
  /** Append-only order, assigned by the database. The key to render by. */
  seq: number;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  topic_ids: string[];
  topic_visit_id: string | null;
  plan_item_id: string | null;
}

export interface SessionTranscript {
  session_id: string;
  messages: TranscriptMessage[];
}

/* -- The report (ISSUE-0045) --------------------------------------------- */

/** One reached Topic.
 *
 *  Deliberately not a `TopicReading`: there is no `alpha`/`beta` here, so no
 *  posterior can be drawn from it. `source_score` and `truth_score` are two
 *  readings — how much of the material the answer explained, and how close to
 *  correct it was — and no function may take them together. The number they
 *  were combined into fed the posterior and is not carried out of the API. */
export interface ReportTopic {
  topic_id: string;
  title: string;
  module_title: string;
  band: Band;
  label: string;
  coverage: number;
  mastery: number | null;
  interval: [number, number] | null;
  /** Null under `model_judgment`: there is no Answer Key to have explained,
   *  and a zero would read as "explained none of the material". */
  source_score: number | null;
  truth_score: number | null;
  graded_by: GradingMode | null;
  question_count: number;
  citations: Citation[];
}

/** A Topic the Session never reached. It gets its name and nothing else — a
 *  separate shape from `ReportTopic`, so there is no field here that a zero
 *  could land in by accident. Untested is not zero. */
export interface UnreachedTopic {
  topic_id: string;
  title: string;
}

export interface SessionReport {
  session_id: string;
  state: string;
  ended_reason: string | null;
  duration_seconds: number;
  provider: string | null;
  /** Null for MCP Mode and for Sessions started before the plan existed. */
  plan: SessionPlan | null;
  topics: ReportTopic[];
  planned_not_reached: UnreachedTopic[];
  /* Deliberately absent: any Session-wide coverage, mastery or score. There is
     no headline number for a Session and there is not going to be one. */
}

/* -- Who is signed in (ISSUE-0048) --------------------------------------- */

export interface CandidateProfile {
  candidate_id: string;
  display_name: string | null;
  /** Derived from `onboarded_at`. The flag the surface gates on. */
  onboarded: boolean;
}

/** The onboarding form's four fields, each optional.
 *
 *  The route forbids unknown keys — one stray field is a 422, not a silent
 *  drop — and leaves omitted ones alone, so a form correcting a name cannot
 *  erase a goal it never asked about. Send only what was collected. */
export interface OnboardingInput {
  display_name?: string;
  target_role?: string;
  experience_level?: string;
  goal?: string;
}

export interface CandidateConfidence {
  coverage: CoverageReading;
  mastery: MasteryReading;
  topics: TopicReading[];
}

export interface LedgerEntry {
  entry_type: string;
  delta_credits: number;
  topic_visit_id: string | null;
  created_at: string;
}

export interface CreditsRecord {
  /* null on BYOK. A Candidate on their own key must never see a Credit
     figure at all — not even a zero. */
  balance: number | null;
  route: PaymentRoute;
  low_balance: boolean;
  ledger: LedgerEntry[];
  byok: {
    key_id: string;
    fingerprint: string;
    status: string;
    credits_spent: null;
  } | null;
}

export interface ProviderPrices {
  prices: {
    provider: string;
    credits_per_visit: number;
    observed_visits: number;
    basis: string;
  }[];
  session_total_quotable: false;
  why: string;
}

export type SourceState = "uploaded" | "ingesting" | "ready" | "failed" | "stub";

export interface NotebookSource {
  source_id: string;
  module_id: string;
  title: string;
  /** A Source exists as soon as its bytes do, so a document is in the Library
   *  before it is examinable. Only `ready` may be scoped to a Session. */
  state: SourceState;
  stub_reason: string | null;
  /** Sections embedded of sections found. Never indeterminate: the total is
   *  measured at upload, before the first provider call — forty seconds of
   *  spinner is indistinguishable from a hang. */
  progress_done: number;
  progress_total: number;
  selectable: boolean;
  /** How many Topics this document was cut into. Served rather than derived:
   *  working it out by joining the Module list against `module_id` is the
   *  surface computing something the server owns (ADR-0009). */
  topic_count: number;
  /** How long the current ingest has been running, and how long since it last
   *  moved. Both reported, neither judged: how long is too long is unknown
   *  until real documents have been through it. */
  elapsed_seconds: number | null;
  since_progress_seconds: number | null;
}

export interface Notebook {
  notebook_id: string;
  candidate_id: string;
  title: string;
  embedding_model: string;
  sources: NotebookSource[];
  /** personal | shared. A shared Library is imported once by an operator and is
   *  read-only to every Candidate — it is what makes two people's Mastery on a
   *  Topic the same measurement rather than two unrelated ones. The surface
   *  offers no control that would write to one. */
  visibility: "personal" | "shared";
  /** When this Library was started. */
  created_at: string | null;
}

/** A page boundary, in the same coordinate space as a span. */
export interface SourcePage {
  number: number;
  char_start: number;
  char_end: number;
  anchor: string;
}

/** Where a Topic was drawn from, addressed into its Source's own text.
 *
 *  `text.slice(char_start, char_end)` is the passage exactly — that is the
 *  discipline the chunker keeps, and it is what lets this surface show the
 *  material a Topic came from rather than a paraphrase of it. The passage is
 *  deliberately not carried here: it is the slice these offsets name. */
export interface TopicSpan {
  chunk_id: string;
  page: number;
  char_start: number;
  char_end: number;
}

/** One Topic a document was cut into, frozen at ingest. */
export interface ExtractedTopic {
  topic_id: string;
  title: string;
  topic_order: number;
  dossier_tokens: number;
  spans: TopicSpan[];
}

/** One document read back: what was extracted, and what became of it.
 *
 *  `text` is what one extractor made of the document and is a cache of it,
 *  never the document itself. The Topics and their spans arrive with it in one
 *  response on purpose: the offsets are only meaningful against this exact
 *  string, and pairing a highlight with a text fetched separately would point
 *  at the wrong passage without anything failing. */
export interface NotebookSourceDetail extends NotebookSource {
  notebook_id: string;
  media_type: string;
  byte_length: number;
  text: string;
  pages: SourcePage[];
  topics: ExtractedTopic[];
}

/** What an upload answers with. Deliberately not what the ingest produced: the
 *  request returns before the embedding starts, so there are no Topics to
 *  report yet — only the work found. */
export interface SourceUploaded {
  source_id: string;
  module_id: string;
  state: SourceState;
  stub_reason: string | null;
  deduplicated: boolean;
  progress_done: number;
  progress_total: number;
}

export interface SourceAdded {
  source_id: string;
  module_id: string;
  state: string;
  topics: number;
  chunks: number;
  /** Figures lifted from the source and attached to a Topic its text drew.
   *  Zero means "none found" where the figure lane is on and "not looked for"
   *  where it is off — the surface is told which rather than inferring it. */
  figures: number;
  dossier_tokens: number;
  deduplicated: boolean;
  stub_reason: string | null;
  cost?:
    | { route: "byok"; tokens: number; embedding_model: string }
    | { route: "credits"; tokens: number; credits: number; embedding_model: string };
}

export interface PoolReading {
  pool: number;
  sum_balances: number;
  headroom: number;
  alert: boolean;
  float_usd: number;
  divergence: number;
}

export interface ProviderReading {
  provider: string;
  visits: number;
  credits: number;
  credits_per_visit: number;
  unpriced_rate: number;
  failure_rate: number;
}

export interface OperatorProviders {
  unpriced_rate: number;
  providers: ProviderReading[];
  /* Weights are set by Grading Mode alone. No normaliser is applied to any
     figure here, and none will be invented. */
  normaliser: null;
}

export interface OperatorSessions {
  sessions: Record<string, unknown>[];
}

/* -- Skills admin ------------------------------------------------------- */
/* A shared Skill is a notebook the team authors, not a Candidate — the
   admin dashboard's own domain, separate from a Candidate's personal
   Library even though both ride the same `notebook` row underneath. */

export interface SourceStateCounts {
  uploaded: number;
  ingesting: number;
  ready: number;
  failed: number;
  stub: number;
}

export interface SharedSkillSummary {
  notebook_id: string;
  title: string;
  active: boolean;
  source_count: number;
  states: SourceStateCounts;
}

export interface SharedSkillSource {
  source_id: string;
  module_id: string;
  title: string;
  state: SourceState;
  stub_reason: string | null;
  progress_done: number;
  progress_total: number;
}

export interface SharedSkillDetail {
  notebook_id: string;
  title: string;
  active: boolean;
  sources: SharedSkillSource[];
}
