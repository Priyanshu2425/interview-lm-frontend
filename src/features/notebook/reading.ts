import type { ExtractedTopic, SourcePage } from "@/shared/types";

/* Turning one document into something readable, with the Topics marked on it.
 *
 * The whole screen rests on one property of the data: `text.slice(char_start,
 * char_end)` is the passage a Topic was cut from, exactly. So this does no
 * matching, no searching and no guessing — it walks the offsets the ingest
 * recorded and cuts the string at them.
 *
 * Pure on purpose. It is the only place a highlight can be put in the wrong
 * place, and a pure function is one a test can hold still. */

export interface Segment {
  /** `page` is a boundary marker; `span` is material a Topic was cut from;
   *  `gap` is prose no Topic claimed. */
  kind: "page" | "span" | "gap";
  page?: number;
  topicId?: string;
  text?: string;
}

interface Cut {
  start: number;
  end: number;
  topicId: string;
}

export function segments(
  text: string,
  pages: SourcePage[],
  topics: ExtractedTopic[],
): Segment[] {
  if (!text) return [];

  const cuts: Cut[] = topics
    .flatMap((t) =>
      t.spans.map((s) => ({
        start: Math.max(0, s.char_start),
        end: Math.min(text.length, s.char_end),
        topicId: t.topic_id,
      })),
    )
    .filter((c) => c.start < c.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  /* Two Topics can be cut from overlapping ranges. Rendering both would print
     the overlapping characters twice, so the earlier cut keeps them and the
     later one starts where it left off — the output is a partition of the
     text, which is the only shape that can be rendered without repeating or
     losing a character. */
  const marks = [...pages].sort((a, b) => a.char_start - b.char_start);
  const out: Segment[] = [];
  let at = 0;
  let nextPage = 0;

  const advanceTo = (limit: number) => {
    while (nextPage < marks.length && marks[nextPage].char_start <= limit) {
      out.push({ kind: "page", page: marks[nextPage].number });
      nextPage += 1;
    }
  };

  const emit = (kind: "span" | "gap", from: number, to: number, topicId?: string) => {
    if (from >= to) return;
    const slice = text.slice(from, to);
    /* The whitespace between two spans is not prose. Emitting it renders an
       empty paragraph, which reads as a hole in the document. */
    if (kind === "gap" && !slice.trim()) return;
    out.push({ kind, text: slice, topicId });
  };

  for (const cut of cuts) {
    const start = Math.max(cut.start, at);
    if (start >= cut.end) continue;
    advanceTo(start);
    emit("gap", at, start);
    advanceTo(start);
    emit("span", start, cut.end, cut.topicId);
    at = cut.end;
  }

  advanceTo(at);
  emit("gap", at, text.length);
  advanceTo(text.length);

  return out;
}
