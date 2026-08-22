import { memo } from "react";
import type { TopicReading } from "@/shared/types";
import { BetaCurve, Coverage, Reading } from "@/ui";
import { bandClass } from "@/shared/utils/band";
import { cn } from "@/shared/utils/cn";

/* Below the floor this renders the word and NO number. There is deliberately
   no branch here that prints one. */
export const TopicRow = memo(function TopicRow({ topic, selected, onSelect }: {
  topic: TopicReading;
  selected: boolean;
  onSelect: (topicId: string) => void;
}) {
  const untested = topic.band === "untested";
  return (
    <button
      type="button"
      className={cn("topic", bandClass(topic.band), untested && "topic--untested")}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(topic.topic_id)}
    >
      <span style={{ minWidth: 0, textAlign: "left" }}>
        <span className="topic-name">{topic.title ?? topic.topic_id}</span>
        <span className="topic-meta">
          <Reading band={topic.band} label={topic.label} mastery={topic.mastery} size="sm" />
          {untested ? null : <Coverage value={topic.coverage} />}
          <span className="caption">
            {untested
              ? "Not enough evidence to put a number on"
              : `${topic.coverage.toFixed(1)} effective visits`}
          </span>
        </span>
      </span>
      <span className="topic-viz">
        <BetaCurve
          alpha={topic.alpha}
          beta={topic.beta}
          band={topic.band}
          label={topic.label}
          mastery={topic.mastery}
          width={92}
          height={40}
        />
      </span>
    </button>
  );
});
