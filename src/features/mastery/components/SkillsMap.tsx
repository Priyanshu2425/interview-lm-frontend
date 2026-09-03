import { useMemo } from "react";
import type { TopicReading } from "@/shared/types";
import { Heat, Legend } from "@/ui";
import type { HeatCell } from "@/ui";

/* One cell per Topic in the corpus. The examined ones carry their band; the
   rest are holes, not dark cells — a hole reads as "not asked", a dark cell
   reads as "failed", and telling those two apart is the whole product.

   The unasked Topics are unnamed here on purpose: the contract does not
   return the identity of a Topic nobody has been examined on, and inventing
   labels for them would be worse than a truthful blank. */
export function SkillsMap({ topics, total, onSelect }: {
  topics: TopicReading[];
  total: number;
  onSelect: (topicId: string) => void;
}) {
  const cells = useMemo<HeatCell[]>(() => {
    const known = topics.map((t) => ({
      key: t.topic_id,
      band: t.band,
      title: t.title ?? t.topic_id,
      label: t.label,
      mastery: t.mastery,
      selectable: true,
    }));
    const holes = Math.max(0, total - topics.length);
    return [
      ...known,
      ...Array.from({ length: holes }, (_, i) => ({
        key: `unasked-${i}`,
        band: "untested" as const,
        title: "Never asked",
        label: "Untested",
        mastery: null,
        selectable: false,
      })),
    ];
  }, [topics, total]);

  return (
    <>
      <div className="between corpus-map-head">
        <div>
          <span className="eyebrow">The corpus at a glance</span>
          <p className="caption" style={{ margin: "var(--s-2) 0 0" }}>
            One cell per Topic. {Math.max(0, total - topics.length)} of {total} have never been asked about.
          </p>
        </div>
        <Legend />
      </div>
      <div className="mt-6">
        <Heat cells={cells} onSelect={onSelect} />
      </div>
    </>
  );
}
