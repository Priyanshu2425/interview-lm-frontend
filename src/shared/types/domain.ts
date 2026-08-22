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
     chosen. Hiding it would make Coverage a measure of what parsed. */
  selectable: boolean;
  stub_reason: string | null;
}

export interface Scope {
  module_count: number;
  topic_count: number;
  ground_truth_topic_count: number;
  strongest_mode: GradingMode | null;
  /* Deliberately absent: any difficulty figure, and any estimate of cost. */
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

export interface QuestionPayload {
  kind: "question" | "probe" | "hint" | "close";
  question: string;
  opening_question: string;
  topic_visit_id: string;
  topic_id: string;
  topic_title: string;
  grading_mode: GradingMode;
  turn: number;
  last_visit?: VisitClosed;
}

export interface VisitClosed {
  kind: "visit_closed";
  topic_visit_id: string;
  topic_id: string;
  topic_title: string;
  score: number;
  rationale: string;
  grading_mode: GradingMode;
  weight: number;
  band: Band;
  band_label: string;
  coverage: number;
  mastery: number | null;
  alpha: number;
  beta: number;
  grader: string;
  provider: string;
  rubric_version: string;
  citations: Citation[];
  recovered?: boolean;
  already_existed?: boolean;
}

export interface SessionEnded {
  session_id: string;
  reason: string;
  balance?: number;
  last_visit?: VisitClosed;
}

export interface SessionParked {
  session_id: string;
  code: string;
  message: string;
  provider: string;
  recoverable: boolean;
}

export type TurnResult =
  | { kind: "question" | "probe" | "hint" | "close"; payload: QuestionPayload }
  | { kind: "visit_closed"; payload: VisitClosed }
  | { kind: "session_ended"; payload: SessionEnded }
  | { kind: "session_parked"; payload: SessionParked };

export interface StartSessionInput {
  candidate_id: string;
  module_ids: string[];
  duration_seconds: number;
  provider?: string;
  payment_route?: PaymentRoute | null;
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
  spend: { credits: number | null; per_topic: number | null; balance?: number };
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

export interface NotebookSource {
  source_id: string;
  module_id: string;
  title: string;
  state: string;
  stub_reason: string | null;
}

export interface Notebook {
  notebook_id: string;
  candidate_id: string;
  title: string;
  embedding_model: string;
  sources: NotebookSource[];
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
