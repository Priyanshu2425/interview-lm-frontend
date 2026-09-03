import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type {
  CandidateConfidence, CandidateProfile, CoverageStanding, CreditsRecord,
  OnboardingInput, ProviderPrices, TopicReading, TopicStanding,
} from "@/shared/types";

export const candidateService = {
  /* Who is signed in, and whether they have ever said so (ISSUE-0048). */
  me: () => api.request<CandidateProfile>(endpoints.candidates.me()),

  /* Writes the fields and stamps the first completion. Omitted fields are
     left alone, and an unknown one is refused rather than dropped — so the
     body is built from the four known keys and never spread from form state. */
  onboard: (input: OnboardingInput) =>
    api.request<CandidateProfile>(endpoints.candidates.me(), {
      method: "PATCH",
      body: input,
    }),

  confidence: () => api.request<CandidateConfidence>(endpoints.candidates.confidence()),

  /* Untested Topics are absent here rather than ranked last — they are
     unknown, not weak, and mixing them in is the exact conflation the whole
     model exists to prevent. */
  weakest: (limit = 10) =>
    api.request<{ topics: TopicReading[] }>(endpoints.candidates.weakest(limit)),

  credits: () => api.request<CreditsRecord>(endpoints.candidates.credits()),

  /* Where a Candidate stands on one Topic. Asked for a Topic at a time and
     never for a list, which is what stops it becoming an order (ADR-0022). */
  topicStanding: (topicId: string) =>
    api.request<TopicStanding>(endpoints.candidates.topicStanding(topicId)),

  /* Coverage compared as Coverage. Its own route, its own shape, never
     combined with the above into a position. */
  coverageStanding: () =>
    api.request<CoverageStanding>(endpoints.candidates.coverageStanding()),

  /* No candidate_id: whose key it is comes from the token that carried it. */
  attachKey: (openrouterKey: string) =>
    api.request<{ key_id: string; fingerprint: string; status: string }>(
      endpoints.candidates.attachKey(),
      { method: "POST", body: { openrouter_key: openrouterKey } },
    ),

  revokeKey: (keyId: string) =>
    api.request<{ status: string }>(endpoints.candidates.revokeKey(keyId), { method: "DELETE" }),

  grant: (candidateId: string, credits: number, paymentRef: string) =>
    api.request<{ entry_id: string; credits: number; already_granted: boolean }>(
      endpoints.credits.grants(),
      { method: "POST", body: { candidate_id: candidateId, credits, payment_ref: paymentRef } },
    ),

  /* History, not a forecast. What previous Topics actually cost — never an
     estimate of what this Session will. */
  prices: () => api.request<ProviderPrices>(endpoints.providers.prices()),
};
