"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ApiError, api, errMsg, type FieldErrors } from "./api";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import type { ProjectDTO } from "./types";
import { btnGhost, btnIcon, btnPrimary, btnSecondary, input, label } from "./ui";

type Row = { key: number; label: string; path: string };

const ABS_PATH = /^([A-Za-z]:[\\/]|\/|\\\\)/;
const LABEL_RE = /^[A-Za-z0-9][\w .-]*$/;

/** Flatten zod issues to `a.b.c` keys (the shared ApiError helper only keeps the first segment). */
function deepFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return out;
  for (const issue of err.details) {
    if (!issue || typeof issue !== "object") continue;
    const { path, message } = issue as { path?: unknown; message?: unknown };
    if (!Array.isArray(path) || !path.length || typeof message !== "string") continue;
    const key = path.map(String).join(".");
    if (!(key in out)) out[key] = message;
  }
  return out;
}

function validateRows(rows: Row[]): Record<number, { label?: string; path?: string }> {
  const out: Record<number, { label?: string; path?: string }> = {};
  const seen = new Map<string, number>();
  for (const r of rows) {
    const e: { label?: string; path?: string } = {};
    const l = r.label.trim();
    const p = r.path.trim();
    if (!l) e.label = "Label is required";
    else if (l.length > 40) e.label = "Max 40 characters";
    else if (!LABEL_RE.test(l)) e.label = "Letters, numbers, space . _ -";
    else if (seen.has(l.toLowerCase())) e.label = "Labels must be unique";
    else seen.set(l.toLowerCase(), r.key);
    if (!p) e.path = "Path is required";
    else if (!ABS_PATH.test(p)) e.path = "Use an absolute path";
    if (e.label || e.path) out[r.key] = e;
  }
  return out;
}

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
  const [nextKey, setNextKey] = useState((project?.repos.length ?? 0) + 1);
  const [rows, setRows] = useState<Row[]>(() =>
    (project?.repos ?? []).map((r, i) => ({ key: i + 1, label: r.label, path: r.path })),
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const close = () => {
    if (saving) return;
    setError(null);
    setFieldErrors({});
    onClose();
  };

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, label: rs.length === 0 ? "main" : "", path: "" }]);
    setNextKey((k) => k + 1);
  };
  const patchRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const rowErrors = validateRows(rows);
  const hasRowErrors = Object.keys(rowErrors).length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setTouched(true);
    if (hasRowErrors) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      repos: rows.map((r) => ({ label: r.label.trim(), path: r.path.trim() })),
    };
    try {
      const p = await api<ProjectDTO>(editing ? `/api/projects/${project.id}` : "/api/projects", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      onSaved(p);
    } catch (err) {
      const fe = deepFieldErrors(err);
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        if (!Object.keys(fe).some((k) => k === "name" || k === "description" || k.startsWith("repos"))) {
          setError(errMsg(err));
        }
      } else setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      dismissable={!saving}
      title={editing ? "Edit project" : "New project"}
      description={editing ? undefined : "A project groups the test plans for one product."}
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
            disabled={saving}
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
            disabled={saving}
          />
          {fieldErrors.description && (
            <p className="mt-1.5 text-[12.5px] text-fail">{fieldErrors.description}</p>
          )}
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-fg">
              Repositories <span className="font-normal text-subtle">— optional</span>
            </span>
            <button type="button" onClick={addRow} disabled={saving} className={`${btnGhost} h-7 px-2`}>
              <Plus className="size-3.5" aria-hidden />
              Add repository
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="text-[12.5px] text-subtle">
              Add one or more local repos (e.g. frontend, backend, mobile) so agents can read git changes.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, i) => {
                const ce = rowErrors[r.key];
                const labelErr = fieldErrors[`repos.${i}.label`] ?? (touched ? ce?.label : undefined);
                const pathErr = fieldErrors[`repos.${i}.path`] ?? (touched ? ce?.path : undefined);
                return (
                  <li key={r.key}>
                    <div className="grid grid-cols-[96px_minmax(0,1fr)_32px] gap-2 sm:grid-cols-[120px_minmax(0,1fr)_32px]">
                      <input
                        className={`${input} text-[12.5px]`}
                        value={r.label}
                        onChange={(e) => patchRow(r.key, { label: e.target.value })}
                        placeholder="frontend"
                        aria-label={`Repository ${i + 1} label`}
                        aria-invalid={!!labelErr}
                        maxLength={40}
                        spellCheck={false}
                        autoComplete="off"
                        disabled={saving}
                      />
                      <input
                        className={`${input} font-mono text-[12.5px]`}
                        value={r.path}
                        onChange={(e) => patchRow(r.key, { path: e.target.value })}
                        placeholder="D:/Projects/my-app"
                        aria-label={`Repository ${i + 1} path`}
                        aria-invalid={!!pathErr}
                        spellCheck={false}
                        autoComplete="off"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        disabled={saving}
                        className={`${btnSecondary} ${btnIcon}`}
                        aria-label={`Remove repository ${i + 1}`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    {(labelErr || pathErr) && (
                      <p className="mt-1 text-[12.5px] text-fail">{[labelErr, pathErr].filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-fail">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} disabled={saving} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className={btnPrimary}>
            {saving && <Spinner />}
            {saving ? "Saving…" : editing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
