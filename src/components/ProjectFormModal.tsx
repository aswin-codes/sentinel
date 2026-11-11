"use client";

import { useState } from "react";
import { ApiError, api, errMsg, type FieldErrors } from "./api";
import { Modal } from "./Modal";
import type { ProjectDTO } from "./types";
import { btnGhost, btnPrimary, input, label } from "./ui";

/** Create (POST /api/projects) or edit (PATCH /api/projects/[id]) a project. Mount with a `key` to reset. */
export function ProjectFormModal({
  open,
  onClose,
  onSaved,
  project,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (p: ProjectDTO) => void;
  project?: ProjectDTO;
}) {
  const editing = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [repoPath, setRepoPath] = useState(project?.repoPath ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const close = () => {
    if (saving) return;
    setError(null);
    setFieldErrors({});
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      repoPath: repoPath.trim() || null,
    };
    try {
      const p = await api<ProjectDTO>(editing ? `/api/projects/${project.id}` : "/api/projects", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      onSaved(p);
    } catch (err) {
      const fe = err instanceof ApiError ? err.fieldErrors : {};
      if (Object.keys(fe).length) setFieldErrors(fe);
      else setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? "Edit project" : "New project"}
      description={editing ? undefined : "A project groups the test plans for one codebase."}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className={label}>
            Name
          </label>
          <input
            id="project-name"
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My app"
            required
            maxLength={200}
          />
          {fieldErrors.name && <p className="mt-1.5 text-[12.5px] text-fail">{fieldErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="project-description" className={label}>
            Description <span className="font-normal text-subtle">— optional</span>
          </label>
          <textarea
            id="project-description"
            className={`${input} min-h-[68px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {fieldErrors.description && (
            <p className="mt-1.5 text-[12.5px] text-fail">{fieldErrors.description}</p>
          )}
        </div>
        <div>
          <label htmlFor="project-repo" className={label}>
            Local repo path <span className="font-normal text-subtle">— optional</span>
          </label>
          <input
            id="project-repo"
            className={`${input} font-mono text-[12.5px]`}
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="D:/Projects/my-app"
            spellCheck={false}
            autoComplete="off"
          />
          {fieldErrors.repoPath ? (
            <p className="mt-1.5 text-[12.5px] text-fail">{fieldErrors.repoPath}</p>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-subtle">Absolute path, lets agents read git changes.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-fail">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className={btnPrimary}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
