import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { CandidateConfidence, CreditsRecord, ProviderPrices, TopicReading } from "@/shared/types";

export const candidateService = {
  confidence: (candidateId: string) =>
    api.request<CandidateConfidence>(endpoints.candidates.confidence(candidateId)),

  /* Untested Topics are absent here rather than ranked last — they are
     unknown, not weak, and mixing them in is the exact conflation the whole
     model exists to prevent. */
  weakest: (candidateId: string, limit = 10) =>
    api.request<{ topics: TopicReading[] }>(endpoints.candidates.weakest(candidateId, limit)),

  credits: (candidateId: string) =>
    api.request<CreditsRecord>(endpoints.candidates.credits(candidateId)),

  attachKey: (candidateId: string, openrouterKey: string) =>
    api.request<{ key_id: string; fingerprint: string; status: string }>(
      endpoints.candidates.attachKey(),
      { method: "POST", body: { candidate_id: candidateId, openrouter_key: openrouterKey } },
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
