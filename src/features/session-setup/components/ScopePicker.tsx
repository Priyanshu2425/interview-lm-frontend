import { useMemo, useState } from "react";
import type { Module } from "@/shared/types";
import { Checkbox, Chip, EmptyState, Icon, Panel, SkeletonLines, Tag, TextField } from "@/ui";
import { GRADING_MODE_SHORT, GRADING_MODE_WEIGHT } from "@/shared/utils/format";
import { useDebounced } from "@/shared/hooks";

interface ScopePickerProps {
  modules: Module[] | undefined;
  loading: boolean;
  selected: ReadonlySet<string>;
  onToggle: (moduleId: string) => void;
  onSetMany: (moduleIds: string[]) => void;
}

type Quick = "all" | "keyed" | "notebook" | null;

export function ScopePicker({ modules, loading, selected, onToggle, onSetMany }: ScopePickerProps) {
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<Quick>(null);
  const search = useDebounced(query.trim().toLowerCase(), 150);

  const visible = useMemo(() => {
    if (!modules) return [];
    if (!search) return modules;
    return modules.filter(
      (m) => m.title.toLowerCase().includes(search) || m.track_key.toLowerCase().includes(search),
    );
  }, [modules, search]);

  const selectable = useMemo(() => (modules ?? []).filter((m) => m.selectable), [modules]);

  if (loading) {
    return (
      <Panel pad={7}>
        <SkeletonLines count={5} label="Loading the Modules in your corpus" />
      </Panel>
    );
  }

  if (!modules || modules.length === 0) {
    return (
      <EmptyState
        icon="notebook"
        title="No Modules to examine yet"
        body="Add material to a notebook and the Adapter will cluster it into Modules and Topics."
      />
    );
  }

  const applyQuick = (next: Quick) => {
    setQuick(next === quick ? null : next);
    if (next === quick) return;
    if (next === "all") onSetMany(selectable.map((m) => m.module_id));
    if (next === "keyed")
      onSetMany(selectable.filter((m) => m.ground_truth_topic_count > 0).map((m) => m.module_id));
    if (next === "notebook")
      onSetMany(selectable.filter((m) => m.track_key.startsWith("nb-")).map((m) => m.module_id));
  };

  const keyedCount = selectable.filter((m) => m.ground_truth_topic_count > 0).length;
  const notebookCount = selectable.filter((m) => m.track_key.startsWith("nb-")).length;

  return (
    <Panel>
      <div className="between pad-6 hair-b" style={{ flexWrap: "wrap" }}>
        <Checkbox
          checked={selectable.length > 0 && selected.size === selectable.length}
          indeterminate={selected.size > 0}
          onChange={(on) => onSetMany(on ? selectable.map((m) => m.module_id) : [])}
        >
          {selected.size > 0 && selected.size < selectable.length
            ? `${selected.size} of ${selectable.length} Modules`
            : `Select all ${selectable.length} Modules`}
        </Checkbox>
        <div className="row g-4" style={{ flexWrap: "wrap" }}>
          <Chip pressed={quick === "keyed"} onClick={() => applyQuick("keyed")} count={keyedCount}>
            Has an Answer Key
          </Chip>
          {notebookCount > 0 ? (
            <Chip pressed={quick === "notebook"} onClick={() => applyQuick("notebook")} count={notebookCount}>
              My notebook
            </Chip>
          ) : null}
        </div>
      </div>

      {modules.length > 8 ? (
        <div className="pad-5 hair-b">
          <TextField
            label="Find a Module"
            search
            placeholder="e.g. attention"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      <div className="pad-5" style={{ maxHeight: 360, overflowY: "auto" }}>
        {visible.length === 0 ? (
          <p className="caption" style={{ padding: "var(--s-6)" }}>
            No Module matches “{query}”.
          </p>
        ) : (
          <ul className="stack g-2" style={{ listStyle: "none" }}>
            {visible.map((m) => (
              <li key={m.module_id}>
                <ModuleRow
                  module={m}
                  checked={selected.has(m.module_id)}
                  onToggle={() => onToggle(m.module_id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function ModuleRow({ module: m, checked, onToggle }: {
  module: Module;
  checked: boolean;
  onToggle: () => void;
}) {
  /* A Module that cannot be examined is listed and cannot be chosen. Hiding it
     would make Coverage a measure of what parsed rather than of what the
     Candidate uploaded — and a document still being read would look like one
     that never arrived. Either way it says which of the two it is: the reason
     is the API's own, never composed here. */
  if (!m.selectable) {
    const waiting = m.state === "uploaded" || m.state === "ingesting";
    return (
      <div className="scope-item" data-unusable="">
        <span className="scope-mark" aria-hidden="true"><Icon name="info" size={13} /></span>
        <span>
          <span className="body-sm">{m.title}</span>
          <span className="caption" style={{ display: "block" }}>
            {m.stub_reason ?? "No text could be read from this source."}{" "}
            {waiting
              ? "It becomes examinable when it has finished."
              : "It holds no Topic, so it cannot be examined."}
          </span>
        </span>
        <Tag tone={waiting ? "accent" : m.state === "failed" ? "risk" : "warn"}>
          {waiting ? "Reading" : m.state === "failed" ? "Failed" : "Unusable"}
        </Tag>
      </div>
    );
  }

  const keyed = m.ground_truth_topic_count;
  return (
    <label className="scope-item">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="check-box" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        <span className="body-sm">{m.title}</span>
        <span className="caption" style={{ display: "block" }}>
          {m.topic_count} Topics
          {keyed > 0 ? ` · ${keyed} with an Answer Key` : " · no Answer Key in this material"}
        </span>
      </span>
      <Tag
        tone={m.ceiling === "ground_truth" ? "ok" : "neutral"}
        title={`Evidence from this Module is weighted ${GRADING_MODE_WEIGHT[m.ceiling]}`}
      >
        {GRADING_MODE_SHORT[m.ceiling]}
      </Tag>
    </label>
  );
}
