import { useCallback, useMemo, useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, ButtonLink, Choice, Dialog, Icon, Panel, SectionHead, SelectField, Switch, Tag,
} from "@/ui";
import { THEMES, useThemeStore } from "@/shared/stores/theme";
import type { ThemeKey } from "@/shared/stores/theme";
import { PROVIDERS, usePreferenceStore } from "@/shared/stores/preferences";
import type { Preferences } from "@/shared/stores/preferences";
import { useIdentityStore } from "@/shared/stores/identity";
import { useToast } from "@/shared/stores/toasts";
import { useCredits } from "@/features/credits/hooks/useCredits";
import { SettingsNav } from "./components/SettingsNav";
import type { SettingsSection } from "./components/SettingsNav";

const SECTIONS: readonly SettingsSection[] = [
  { id: "set-session", label: "Session defaults", hint: "Scope, duration, Provider" },
  { id: "set-surface", label: "Examination surface", hint: "What opens, what confirms" },
  { id: "set-appearance", label: "Appearance", hint: "Five variations" },
  { id: "set-billing", label: "Billing route", hint: "Credits or your own key" },
  { id: "set-data", label: "Identity and data", hint: "What this browser holds" },
];

const DURATIONS = [
  { value: 1500, title: "25 minutes", sub: "A short sitting" },
  { value: 3000, title: "50 minutes", sub: "A full sitting" },
  { value: 0, title: "Until I stop", sub: "Ends after the Visit in progress" },
] as const;

/* Two kinds of setting live on this screen, and they behave differently on
   purpose:

   - Session defaults and surface behaviour are a form. They stage, and a save
     bar appears when something is dirty, because changing four of them and
     committing once is the shape of that task.
   - Appearance applies on the click. A variation you cannot see until you
     press Save is a preview you did not get. */
export function SettingsScreen() {
  const saved = usePreferenceStore((s) => s.prefs);
  const save = usePreferenceStore((s) => s.save);
  const resetPrefs = usePreferenceStore((s) => s.reset);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const candidateId = useIdentityStore((s) => s.candidateId);
  const { data: credits } = useCredits();
  const toast = useToast();

  const [draft, setDraft] = useState<Preferences>(saved);
  const [resetOpen, setResetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /* The store is the source of truth. If it changes underneath — a reset, or
     a save — the draft follows rather than silently re-committing stale values
     later. Adjusted during render, so the form never paints a value the store
     has already replaced. */
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setDraft(saved);
  }

  const dirty = useMemo(
    () => (Object.keys(saved) as (keyof Preferences)[]).some((k) => saved[k] !== draft[k]),
    [saved, draft],
  );

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const commit = () => {
    save(draft);
    toast({ title: "Settings saved", body: "They apply to your next Session.", tone: "ok" });
  };

  const clearBrowser = () => {
    resetPrefs();
    try {
      localStorage.removeItem("ilm.sessions.v1");
    } catch { /* nothing to remove */ }
    setResetOpen(false);
    toast({
      title: "This browser was reset",
      body: "Nothing on the server was touched. Your Evidence is intact.",
    });
  };

  return (
    <>
      <PageHeader title="Settings" sub="Defaults for the next Session, and how this surface behaves" />

      <Workbench narrow side={<SettingsNav sections={SECTIONS} />}>
        <p className="eyebrow">Configuration</p>
        <h1 className="display-3 mt-4">What holds between Sessions.</h1>
        <p className="prose mt-6">
          A Session&rsquo;s scope, duration and rules are fixed before it starts and travel with it. Nothing
          here reaches a Session already running — changing the terms of an examination halfway through would
          make its record mean two different things.
        </p>

        {/* ------------------------------------------------ session ---- */}
        <section className="mt-11" id="set-session" aria-labelledby="set-session-h">
          <SectionHead title="Session defaults" aside="Used when you open a new Session" />
          <div className="stack g-8">
            <div>
              <span className="label" id="dur-label">Default duration</span>
              <p className="caption mt-3" style={{ maxWidth: "58ch" }}>
                The deadline is soft either way: when it passes, the Session finishes the Topic in progress
                and then stops. It never cuts an answer in half.
              </p>
              <div className="grid-3 mt-5" role="radiogroup" aria-labelledby="dur-label">
                {DURATIONS.map((d) => (
                  <Choice
                    key={d.value}
                    name="default-duration"
                    value={String(d.value)}
                    checked={draft.defaultDuration === d.value}
                    onChange={(v) => set("defaultDuration", Number(v))}
                    title={d.title}
                    sub={d.sub}
                  />
                ))}
              </div>
            </div>

            <div className="grid-2">
              <SelectField
                label="Provider"
                options={PROVIDERS}
                value={draft.provider}
                onChange={(e) => set("provider", e.target.value)}
                hint="Recorded on every Evidence row alongside what the call cost."
              />
              <p className="caption" style={{ alignSelf: "end" }}>
                A Provider failure parks the Session rather than failing over to another. Switching graders
                mid-Visit would split one score across two of them and corrupt the provenance record.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ surface ---- */}
        <section className="mt-11" id="set-surface">
          <SectionHead title="Examination surface" aside="How this screen behaves, not how grading works" />
          <Panel pad={7} className="stack g-7">
            <Switch
              checked={draft.openGroundingFirst}
              onChange={(v) => set("openGroundingFirst", v)}
            >
              Open the Grounding panel first
              <span className="caption" style={{ display: "block" }}>
                Otherwise the Confidence panel opens, showing where the Topic stood before this Visit.
              </span>
            </Switch>
            <Switch
              checked={draft.confirmBeforeEnding}
              onChange={(v) => set("confirmBeforeEnding", v)}
            >
              Confirm before ending a Session
              <span className="caption" style={{ display: "block" }}>
                Ending is soft — the Topic in progress is examined to the end and scored either way — but it
                is not reversible, so it asks by default.
              </span>
            </Switch>
          </Panel>
        </section>

        {/* --------------------------------------------- appearance ---- */}
        <section className="mt-11" id="set-appearance">
          <SectionHead title="Appearance" aside="Applies immediately" />
          <div className="variation-grid" role="radiogroup" aria-label="Colour variation">
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={t.key === theme}
                className="variation"
                data-theme={t.key}
                onClick={() => setTheme(t.key as ThemeKey)}
              >
                <span className="variation-swatches" aria-hidden="true">
                  <i style={{ background: "var(--bg)" }} />
                  <i style={{ background: "var(--surface-2)" }} />
                  <i style={{ background: "var(--accent)" }} />
                  <i style={{ background: "var(--fg-2)" }} />
                </span>
                <span className="variation-name">{t.name}</span>
                <span className="caption">{t.scene}</span>
              </button>
            ))}
          </div>
          <p className="caption mt-5">
            Every variation encodes the same facts. The confidence ramp is derived from whichever palette is
            active, so an Untested Topic shows no number in all five — that is a property of the data, not of
            the pigment.
          </p>
        </section>

        {/* ------------------------------------------------ billing ---- */}
        <section className="mt-11" id="set-billing">
          <SectionHead title="Billing route" aside="Decided from your key, not from this screen" />
          <Panel pad={7} className="stack g-6">
            <div className="between">
              <div>
                <strong className="body-sm">
                  {credits?.route === "byok" ? "Your own OpenRouter key" : "Credits"}
                </strong>
                <p className="caption" style={{ margin: "var(--s-3) 0 0", maxWidth: "56ch" }}>
                  {credits?.route === "byok"
                    ? "Your Provider bills you directly. No Credits are spent, and no Credit figure is shown anywhere in the product."
                    : "Metered in real cents per graded call. A Visit already running finishes even on an exhausted balance — the permanent write outranks the billing check."}
                </p>
              </div>
              <Tag tone={credits?.route === "byok" ? "accent" : "neutral"}>
                {credits?.route === "byok" ? "BYOK" : "Credits"}
              </Tag>
            </div>
            <div className="row g-4">
              <ButtonLink to="/credits" variant="secondary" size="sm">
                <Icon name="cost" size={14} />
                Open the ledger
              </ButtonLink>
            </div>
          </Panel>
        </section>

        {/* --------------------------------------------------- data ---- */}
        <section className="mt-11" id="set-data">
          <SectionHead title="Identity and data" aside="What this browser holds" />
          <Panel pad={7} className="stack g-7">
            <div className="between">
              <div style={{ minWidth: 0 }}>
                <span className="label">Candidate id</span>
                <p className="caption" style={{ margin: "var(--s-3) 0 0", maxWidth: "56ch" }}>
                  Sign-in is not built yet, so this browser carries an id it generated. Your Evidence is filed
                  against it — losing it means losing the handle on your record, not the record itself.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(candidateId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? "Copied" : candidateId}
              </Button>
            </div>

            <div className="between hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <div style={{ minWidth: 0 }}>
                <span className="label">Reset this browser</span>
                <p className="caption" style={{ margin: "var(--s-3) 0 0", maxWidth: "56ch" }}>
                  Clears the settings and the list of Sessions this browser remembers. Nothing on the server is
                  touched — every Evidence row survives, and a Session you know the id of can still be opened.
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
                Reset
              </Button>
            </div>
          </Panel>
        </section>

        {dirty ? (
          <div className="actionbar" role="region" aria-label="Unsaved changes">
            <span className="body-sm">
              <strong>Unsaved changes.</strong>{" "}
              <span className="dim">They take effect on your next Session.</span>
            </span>
            <span className="row g-4">
              <Button variant="ghost" onClick={() => setDraft(saved)}>Discard</Button>
              <Button variant="primary" onClick={commit}>Save settings</Button>
            </span>
          </div>
        ) : (
          <p className="caption mt-9" role="status">All changes saved.</p>
        )}
      </Workbench>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset what this browser remembers?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Keep it</Button>
            <Button variant="danger" data-autofocus onClick={clearBrowser}>Reset this browser</Button>
          </>
        }
      >
        Your settings and the list of recent Sessions are cleared. Your candidate id, your Credit balance and
        every Evidence row live on the server and are untouched.
      </Dialog>
    </>
  );
}
