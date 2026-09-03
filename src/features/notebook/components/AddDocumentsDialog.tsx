import { useState } from "react";
import { Button, Dialog, TabPanel, Tabs, TextAreaField, TextField } from "@/ui";
import type { TabItem } from "@/ui";
import { Dropzone } from "./Dropzone";

type Way = "files" | "note";

const WAYS: readonly TabItem<Way>[] = [
  { key: "files", label: "Files" },
  { key: "note", label: "Paste a note" },
];

/* The two ways material gets into a notebook, in the one place that adds it.
   A document belongs to a notebook, so this is reached from inside one. */
export function AddDocumentsDialog({ open, onClose, onFiles, onText, busy }: {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  onText: (title: string, text: string) => void;
  busy: boolean;
}) {
  const [way, setWay] = useState<Way>("files");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const paste = () => {
    if (!title.trim() || !text.trim()) return;
    onText(title.trim(), text);
    setTitle("");
    setText("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add documents"
      footer={
        way === "note" ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={paste}
              loading={busy}
              loadingLabel="Adding…"
              disabled={!title.trim() || !text.trim()}
            >
              Add the note
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>Done</Button>
        )
      }
    >
      <Tabs items={WAYS} value={way} onChange={setWay} label="How to add material" />

      <TabPanel id="pane-files" active={way === "files"}>
        <div className="mt-6">
          <Dropzone
            disabled={busy}
            busy={busy}
            onFiles={(files) => { onFiles(files); onClose(); }}
          />
        </div>
      </TabPanel>

      <TabPanel id="pane-note" active={way === "note"}>
        <div className="stack g-6 mt-6">
          <TextField
            label="Title"
            hint="What this note is, so you can find it in the list."
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <TextAreaField
            label="The note"
            hint="Markdown is read as Markdown."
            rows={10}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
        </div>
      </TabPanel>
    </Dialog>
  );
}
