"use client";

import { useState } from "react";
import { api, errMsg } from "./api";
import { Modal } from "./Modal";
import type { Project } from "./types";
import { btnGhost, btnPrimary, input, monoLabel } from "./ui";

export function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (saving) return;
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const p = await api<Project>("/api/projects", {
        method: "POST",
        body: {
          name: name.trim(),
          ...(repoPath.trim() && { repoPath: repoPath.trim() }),
          ...(description.trim() && { description: description.trim() }),
        },
      });
      setName("");
      setRepoPath("");
      setDescription("");
      onCreated(p);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="New project" description="A project groups test plans for one codebase.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={`${monoLabel} mb-1.5 block`}>Name</span>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bombay Canvas"
            required
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className={`${monoLabel} mb-1.5 block`}>Local repo path</span>
          <input
            className={`${input} font-mono text-[12.5px]`}
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="D:/Projects/bombay-canvas"
            spellCheck={false}
          />
          <span className="mt-1.5 block text-[12px] text-muted">
            Absolute path. Lets QA Hub show the branch and lets agents read the diff.
          </span>
        </label>
        <label className="block">
          <span className={`${monoLabel} mb-1.5 block`}>Description</span>
          <textarea
            className={`${input} min-h-[72px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-[6px] border border-fail/30 bg-fail/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className={btnPrimary}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
