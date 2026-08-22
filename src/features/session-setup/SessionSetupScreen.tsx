import { useCallback, useMemo, useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import { ButtonLink, Choice, Icon, Panel, SelectField } from "@/ui";
import { PROVIDERS, usePreferenceStore } from "@/shared/stores/preferences";
import { useLatestRunningSession } from "@/shared/stores/sessionHistory";
import { useModules, useScope } from "./hooks/useCorpus";
import { useStartSession } from "./hooks/useStartSession";
import { ScopePicker } from "./components/ScopePicker";
import { SessionPreview } from "./components/SessionPreview";
import { EvidenceRules } from "./components/EvidenceRules";

const DURATIONS = [
  { value: 1500, title: "25 minutes", sub: "A short sitting · soft deadline" },
  { value: 3000, title: "50 minutes", sub: "A full sitting · soft deadline" },
  { value: 0, title: "Until I stop", sub: "Ends after the Visit in progress" },
] as const;

/* An open-ended Session still needs a positive duration on the wire; the
   deadline is soft either way. Twelve hours is "until I stop" expressed in
   the only unit the contract accepts. */
const OPEN_ENDED_SECONDS = 12 * 60 * 60;

export function SessionSetupScreen() {
  const { data: modules, isPending } = useModules();
  const prefs = usePreferenceStore((s) => s.prefs);
  const savePrefs = usePreferenceStore((s) => s.save);
  const running = useLatestRunningSession();
  const start = useStartSession();

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [durationChoice, setDurationChoice] = useState<number>(prefs.defaultDuration);

  const moduleIds = useMemo(() => [...selected].sort(), [selected]);
  const { data: scope, isFetching: loadingScope } = useScope(moduleIds);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[]) => setSelected(new Set(ids)), []);

  const durationSeconds = durationChoice === 0 ? OPEN_ENDED_SECONDS : durationChoice;

  const blocked =
    moduleIds.length === 0
      ? "Choose at least one Module before starting."
      : scope && scope.topic_count === 0
        ? "Nothing in this scope holds an examinable Topic."
        : null;

  return (
    <>
      <PageHeader title="New Session" sub="Scope and duration, fixed before the first question">
        {running ? (
          <ButtonLink to={`/examination/${running.id}`} variant="ghost" size="sm">
            <Icon name="resume" size={14} />
            Resume the open Session
          </ButtonLink>
        ) : null}
      </PageHeader>

      <Workbench
        narrow
        side={
          <SessionPreview
            scope={scope}
            loadingScope={loadingScope}
            moduleCount={moduleIds.length}
            durationSeconds={durationChoice === 0 ? 0 : durationSeconds}
            provider={prefs.provider}
            starting={start.isPending}
            blocked={blocked}
            onBegin={() => start.mutate({ moduleIds, durationSeconds, provider: prefs.provider })}
          />
        }
      >
        <p className="eyebrow">Before a single question</p>
        <h1 className="display-3 mt-4">Scope and duration.</h1>
        <p className="prose mt-6">
          Two decisions, made once. After this the Session proceeds as Topic Visits and does not ask you
          anything else about itself.
        </p>

        <section className="mt-11" aria-labelledby="step-scope">
          <div className="section-head">
            <div>
              <span className="step-n">Step 01</span>
              <h2 className="h2 mt-3" id="step-scope">Scope</h2>
            </div>
            <span className="caption">
              {moduleIds.length === 0
                ? "Nothing chosen yet"
                : `${moduleIds.length} chosen · ${scope?.topic_count ?? "…"} Topics`}
            </span>
          </div>
          <ScopePicker
            modules={modules}
            loading={isPending}
            selected={selected}
            onToggle={toggle}
            onSetMany={setMany}
          />
          <p className="caption mt-4">
            The scheduler picks Topics inside this scope. It can tell an unasked Topic from a failed one, which
            is the whole reason it can choose well.
          </p>
        </section>

        <section className="mt-11" aria-labelledby="step-duration">
          <div className="section-head">
            <div>
              <span className="step-n">Step 02</span>
              <h2 className="h2 mt-3" id="step-duration">Duration</h2>
            </div>
            <span className="caption">Soft deadline</span>
          </div>
          <div className="grid-3" role="radiogroup" aria-labelledby="step-duration">
            {DURATIONS.map((d) => (
              <Choice
                key={d.value}
                name="duration"
                value={String(d.value)}
                checked={durationChoice === d.value}
                onChange={(v) => {
                  const next = Number(v);
                  setDurationChoice(next);
                  savePrefs({ ...prefs, defaultDuration: next });
                }}
                title={d.title}
                sub={d.sub}
              />
            ))}
          </div>
          <Panel tone="2" pad={6} className="mt-6 rule-note">
            <Icon name="timer" size={16} />
            <p className="body-sm dim" style={{ margin: 0 }}>
              The deadline is soft. When it passes the Session finishes the current Visit and then stops —
              never mid-answer. A half-examined answer would corrupt the record the Session exists to build.
            </p>
          </Panel>
        </section>

        <section className="mt-11" aria-labelledby="step-rules">
          <div className="section-head">
            <div>
              <span className="step-n">Step 03</span>
              <h2 className="h2 mt-3" id="step-rules">Rules of evidence</h2>
            </div>
            <span className="caption">In force, not adjustable</span>
          </div>
          <EvidenceRules />

          <div className="grid-2 mt-8">
            <SelectField
              label="Provider"
              options={PROVIDERS}
              value={prefs.provider}
              onChange={(e) => savePrefs({ ...prefs, provider: e.target.value })}
              hint="Recorded on every Evidence row alongside its cost. Kept for your next Session too."
            />
            <p className="caption" style={{ alignSelf: "end" }}>
              Which ledger pays is settled from your key situation when the Session starts, not from this
              screen — a Session that billed Credits against an attached key would charge twice over.
            </p>
          </div>
        </section>
      </Workbench>
    </>
  );
}
