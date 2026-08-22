import { useCallback, useRef, useState } from "react";
import { Icon } from "@/ui";

/* Nothing is examinable until the Adapter has named its Topics, so the copy
   says that here rather than after the upload. */
export function Dropzone({ onFiles, disabled, busy }: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
  busy: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }, [onFiles]);

  return (
    <>
      <button
        type="button"
        className="dropzone"
        data-over={over ? "" : undefined}
        disabled={disabled || busy}
        aria-describedby="dropzone-hint"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <Icon name="upload" size={26} strokeWidth={1.4} />
        <span className="body-sm">
          {busy ? "Ingesting…" : "Drop PDFs, notes or saved pages"}
        </span>
        <span className="caption" id="dropzone-hint">
          The Adapter chunks, embeds and clusters them into Modules and Topics. Nothing is examinable until
          its Topics are named.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="visually-hidden"
        accept=".pdf,.md,.markdown,.txt,.html,.htm"
        onChange={(e) => { take(e.target.files); e.target.value = ""; }}
      />
    </>
  );
}
