import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import {
  ButtonLink, Chip, EmptyState, ErrorState, Icon, Panel, SkeletonLines, Stat, TextField,
} from "@/ui";
import type { Band, TopicReading } from "@/shared/types";
import { useConfidence, useUntestedModules } from "./hooks/useMastery";
import { CorpusMap } from "./components/CorpusMap";
import { TopicRow } from "./components/TopicRow";
import { TopicDetail } from "./components/TopicDetail";

type Filter = "all" | "weak" | "early" | "solid";

/* Hoisted so an absent response does not hand useMemo a fresh array on every
   render, which would re-filter the whole corpus for nothing. */
const NO_TOPICS: TopicReading[] = [];

const FILTER_BANDS: Record<Exclude<Filter, "all">, Band> = {
  weak: "firm_weak",
  early: "early",
  solid: "firm_strong",
};

export function MasteryScreen() {
  const { data, isPending, error } = useConfidence();
  const { data: untestedModules } = useUntestedModules();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Typing stays responsive while a corpus-sized list re-filters behind it. */
  const search = useDeferredValue(query.trim().toLowerCase());

  const topics = data?.topics ?? NO_TOPICS;

  const visible = useMemo(() => {
    let out = topics;
    if (filter !== "all") out = out.filter((t) => t.band === FILTER_BANDS[filter]);
    if (search) out = out.filter((t) => (t.title ?? t.topic_id).toLowerCase().includes(search));
    return out;
  }, [topics, filter, search]);

  const selected = useMemo(
    () => topics.find((t) => t.topic_id === selectedId) ?? null,
    [topics, selectedId],
  );

  if (error) {
    return (
      <>
        <PageHeader title="Mastery map" />
        <Workbench><ErrorState title="The readings could not be loaded" message={(error as Error).message} /></Workbench>
      </>
    );
  }

  const coverage = data?.coverage;
  const mastery = data?.mastery;
  const untestedCount = coverage ? coverage.topics_total - coverage.topics_examined : 0;

  return (
    <>
      <PageHeader
        title="Mastery map"
        sub={coverage ? `${coverage.topics_total} Topics in the corpus` : undefined}
      >
        <ButtonLink to="/session/new" variant="secondary" size="sm">New Session</ButtonLink>
      </PageHeader>

      <Workbench side={<TopicDetail topic={selected} />}>
        {isPending ? (
          <SkeletonLines count={6} label="Reading your Topic Confidence" />
        ) : coverage && coverage.topics_examined === 0 ? (
          <EmptyState
            icon="mastery"
            title="Nothing has been examined yet"
            body={`All ${coverage.topics_total} Topics in the corpus are Untested. That is not a score of zero — it is the absence of a question, and it is the first thing a Session fixes.`}
            action={
              <ButtonLink to="/session/new" variant="primary">
                <Icon name="scope" size={14} />
                Set scope and duration
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* Coverage and Mastery, as two readings. There is no element on
                this screen that merges them into one figure. */}
            <div className="grid-4 readings-row">
              <Stat
                label="On record"
                value={coverage?.topics_examined ?? "—"}
                unit={coverage ? `/ ${coverage.topics_total}` : undefined}
                note="Topics with evidence behind them."
              />
              <Stat
                label="Never asked"
                value={untestedCount}
                note="Held separate. Never counted as a low score."
              />
              <Stat
                label="Looks weak"
                value={mastery?.looks_weak ?? "—"}
                note="Enough evidence to say so, and it says so."
              />
              <Stat
                label="Effective visits"
                value={coverage ? coverage.effective_visits.toFixed(1) : "—"}
                note="Graded answers, weighted by how they were graded."
              />
            </div>

            <Panel pad={7} className="mt-8">
              <CorpusMap
                topics={topics}
                total={coverage?.topics_total ?? topics.length}
                onSelect={setSelectedId}
              />
            </Panel>

            <div className="between mt-9 filter-row">
              <div className="wrapflex g-3">
                <Chip pressed={filter === "all"} onClick={() => setFilter("all")} count={topics.length}>
                  On record
                </Chip>
                <Chip
                  pressed={filter === "weak"}
                  onClick={() => setFilter("weak")}
                  count={mastery?.looks_weak}
                >
                  Looks weak
                </Chip>
                <Chip
                  pressed={filter === "early"}
                  onClick={() => setFilter("early")}
                  count={mastery?.early_signal}
                >
                  Early signal
                </Chip>
                <Chip
                  pressed={filter === "solid"}
                  onClick={() => setFilter("solid")}
                  count={mastery?.looks_solid}
                >
                  Looks solid
                </Chip>
              </div>
              <div className="filter-search">
                <TextField
                  label="Find a Topic"
                  search
                  placeholder="e.g. attention masking"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="stack g-2 mt-6">
              {visible.length === 0 ? (
                <EmptyState
                  title="No Topic on record matches that"
                  body="Untested Topics are not in this list — they have no reading to filter by."
                />
              ) : (
                visible.map((topic) => (
                  <TopicRow
                    key={topic.topic_id}
                    topic={topic}
                    selected={topic.topic_id === selectedId}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>

            {/* The unasked Topics are the product's central claim, so they get
                a section of their own rather than a footnote under the ones
                that happen to have numbers. */}
            <section className="mt-11" aria-labelledby="never-asked">
              <div className="section-head">
                <h2 className="h2" id="never-asked">What has never been asked</h2>
                <span className="caption">{untestedCount} Topics · not a low score</span>
              </div>
              {untestedModules && untestedModules.length > 0 ? (
                <Panel>
                  <ul style={{ listStyle: "none" }}>
                    {untestedModules.map((m, i) => (
                      <li key={m.module_id} className={`untested-row${i ? " hair-t" : ""}`}>
                        <span>
                          <span className="body-sm" style={{ color: "var(--fg)" }}>{m.title}</span>
                          <span className="caption" style={{ display: "block", marginTop: "var(--s-2)" }}>
                            {m.has_ground_truth
                              ? "Carries an Answer Key — evidence from here counts at full weight."
                              : "No Answer Key in this material. Still examinable, at a lower weight."}
                          </span>
                        </span>
                        <span className="untested-count">
                          <strong className="mono">{m.topics_untested}</strong>
                          <span className="caption"> / {m.topics_total} unasked</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : (
                <Panel pad={7}>
                  <p className="body-sm dim" style={{ margin: 0 }}>
                    {untestedCount === 0
                      ? "Every Topic in the corpus has evidence behind it."
                      : `${untestedCount} Topics have never been asked about. The per-Module breakdown arrives with your first Session record.`}
                  </p>
                </Panel>
              )}
            </section>
          </>
        )}
      </Workbench>
    </>
  );
}
