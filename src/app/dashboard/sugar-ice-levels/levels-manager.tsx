"use client";

import { type FormEvent, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconPencil,
  IconPlus,
  IconStarFilled,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import type { MenuOptionLevelDTO, OptionLevelKind } from "@/lib/dashboard/types";

type LevelsManagerProps = {
  initialSugarLevels: MenuOptionLevelDTO[];
  initialIceLevels: MenuOptionLevelDTO[];
  initialError?: string;
};

type LevelRow = MenuOptionLevelDTO;

function toDTO(row: {
  id: string;
  kind: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): LevelRow {
  return {
    id: row.id,
    kind: row.kind === "ice" ? "ice" : "sugar",
    name: row.name,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingTableError(message: string | null | undefined) {
  if (!message) return false;
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("menu_option_levels") ||
    message.includes("Table is missing")
  );
}

export function LevelsManager({
  initialSugarLevels,
  initialIceLevels,
  initialError,
}: LevelsManagerProps) {
  const [sugarLevels, setSugarLevels] = useState(initialSugarLevels);
  const [iceLevels, setIceLevels] = useState(initialIceLevels);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [setupSql, setSetupSql] = useState<string | null>(null);
  const [sqlEditorUrl, setSqlEditorUrl] = useState("https://supabase.com/dashboard");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  const needsSetup =
    isMissingTableError(error) || (sugarLevels.length === 0 && iceLevels.length === 0 && Boolean(error));

  function setLevelsForKind(kind: OptionLevelKind, next: LevelRow[]) {
    if (kind === "sugar") setSugarLevels(next);
    else setIceLevels(next);
  }

  function levelsForKind(kind: OptionLevelKind) {
    return kind === "sugar" ? sugarLevels : iceLevels;
  }

  function applyLevels(rows: LevelRow[]) {
    setSugarLevels(rows.filter((row) => row.kind === "sugar"));
    setIceLevels(rows.filter((row) => row.kind === "ice"));
  }

  async function installDefaults() {
    setInstalling(true);
    setError(null);
    setCopied(false);

    const response = await fetch("/api/menu/option-levels/setup", { method: "POST" });
    const payload = (await response.json()) as {
      ok?: boolean;
      levels?: Array<{
        id: string;
        kind: string;
        name: string;
        sort_order: number;
        is_default: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      error?: string;
      sql?: string;
      sqlEditorUrl?: string;
      needsMigration?: boolean;
    };

    if (payload.sql) setSetupSql(payload.sql);
    if (payload.sqlEditorUrl) setSqlEditorUrl(payload.sqlEditorUrl);

    if (!response.ok || !payload.levels) {
      setError(payload.error ?? "Could not install default levels.");
      setInstalling(false);
      return;
    }

    applyLevels(payload.levels.map(toDTO));
    setError(null);
    setSetupSql(null);
    setInstalling(false);
  }

  async function copySql() {
    let sql = setupSql;
    if (!sql) {
      const response = await fetch("/api/menu/option-levels/setup");
      const payload = (await response.json()) as { sql?: string; sqlEditorUrl?: string };
      sql = payload.sql ?? "";
      setSetupSql(sql);
      if (payload.sqlEditorUrl) setSqlEditorUrl(payload.sqlEditorUrl);
    }
    if (!sql) return;
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function addLevel(kind: OptionLevelKind, name: string) {
    setError(null);
    setBusyId(`add-${kind}`);
    const response = await fetch("/api/menu/option-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        name,
        sortOrder: levelsForKind(kind).length,
        isDefault: levelsForKind(kind).length === 0,
      }),
    });
    const payload = (await response.json()) as {
      level?: {
        id: string;
        kind: string;
        name: string;
        sort_order: number;
        is_default: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      error?: string;
    };

    if (!response.ok || !payload.level) {
      setError(payload.error ?? "Could not create level.");
      setBusyId(null);
      return;
    }

    setLevelsForKind(kind, [...levelsForKind(kind), toDTO(payload.level)]);
    setBusyId(null);
  }

  async function renameLevel(level: LevelRow, name: string) {
    setError(null);
    setBusyId(level.id);
    const response = await fetch(`/api/menu/option-levels/${level.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = (await response.json()) as {
      level?: {
        id: string;
        kind: string;
        name: string;
        sort_order: number;
        is_default: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      error?: string;
    };

    if (!response.ok || !payload.level) {
      setError(payload.error ?? "Could not rename level.");
      setBusyId(null);
      return false;
    }

    setLevelsForKind(
      level.kind,
      levelsForKind(level.kind).map((entry) =>
        entry.id === level.id ? toDTO(payload.level!) : entry,
      ),
    );
    setBusyId(null);
    return true;
  }

  async function setDefault(level: LevelRow) {
    if (level.isDefault) return;
    setError(null);
    setBusyId(level.id);
    const response = await fetch(`/api/menu/option-levels/${level.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Could not set default.");
      setBusyId(null);
      return;
    }

    setLevelsForKind(
      level.kind,
      levelsForKind(level.kind).map((entry) => ({
        ...entry,
        isDefault: entry.id === level.id,
      })),
    );
    setBusyId(null);
  }

  async function deleteLevel(level: LevelRow) {
    if (!window.confirm(`Delete "${level.name}"?`)) return;
    setError(null);
    setBusyId(level.id);
    const response = await fetch(`/api/menu/option-levels/${level.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Could not delete level.");
      setBusyId(null);
      return;
    }

    setLevelsForKind(
      level.kind,
      levelsForKind(level.kind).filter((entry) => entry.id !== level.id),
    );
    setBusyId(null);
  }

  return (
    <div>
      <div className="mb-[18px]">
        <h1 className="font-serif text-xl font-bold text-foreground">Sugar &amp; Ice Levels</h1>
        <p className="mt-0.5 text-xs text-(--muted)">
          Managed once here — every menu item references this same list, same pattern as Toppings.
        </p>
      </div>

      {needsSetup || sugarLevels.length + iceLevels.length === 0 ? (
        <div className="mb-4 rounded-[14px] border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-4 py-4">
          <p className="text-[13px] font-bold text-(--accent-strong)">
            Install the default Sugar &amp; Ice values
          </p>
          <p className="mt-1 text-[11.5px] leading-5 text-(--accent-strong)/90">
            Sugar: Less Sugar ★, Light Sugar, Minimal Sugar, No Added, Super Sweet · Ice: No Ice,
            Less Ice, Normal Ice ★, More Ice
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void installDefaults()}
              disabled={installing}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-(--accent) bg-(--accent) px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:opacity-60"
            >
              <IconPlus size={15} stroke={2.2} aria-hidden />
              {installing ? "Installing..." : "Install defaults"}
            </button>
            <button
              type="button"
              onClick={() => void copySql()}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-(--line) bg-white px-3.5 text-[12.5px] font-semibold text-foreground transition hover:border-(--accent)"
            >
              {copied ? <IconCheck size={15} stroke={2.2} aria-hidden /> : <IconCopy size={15} stroke={1.8} aria-hidden />}
              {copied ? "SQL copied" : "Copy setup SQL"}
            </button>
          </div>
          {isMissingTableError(error) ? (
            <p className="mt-3 text-[11px] leading-5 text-(--accent-strong)">
              First paste the setup SQL into{" "}
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline"
              >
                Supabase SQL Editor
              </a>
              , click Run, then press Install defaults.
            </p>
          ) : null}
        </div>
      ) : null}

      {error && !isMissingTableError(error) ? (
        <p
          role="alert"
          className="mb-3.5 rounded-xl border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-xs leading-5 text-(--accent-strong)"
        >
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <LevelPanel
          title="Sugar Level"
          subtitle={`${sugarLevels.length} value${sugarLevels.length === 1 ? "" : "s"} · click ✎ to rename anywhere it's used`}
          kind="sugar"
          levels={sugarLevels}
          busyId={busyId}
          onAdd={addLevel}
          onRename={renameLevel}
          onSetDefault={setDefault}
          onDelete={deleteLevel}
        />
        <LevelPanel
          title="Ice Level"
          subtitle={`${iceLevels.length} value${iceLevels.length === 1 ? "" : "s"}`}
          kind="ice"
          levels={iceLevels}
          busyId={busyId}
          onAdd={addLevel}
          onRename={renameLevel}
          onSetDefault={setDefault}
          onDelete={deleteLevel}
        />
      </div>

      <p className="mt-3.5 rounded-lg border border-dashed border-[#d9b57a] bg-[#fdf3e3] px-3 py-2.5 text-[10.5px] leading-5 text-(--accent-strong)">
        Dev note: this tab is new — previously Sugar/Ice values had no management screen. &quot;★
        default&quot; is the global fallback; individual menu items can override their own default in
        Menu → Options &amp; Toppings without changing it here.
      </p>
    </div>
  );
}

function LevelPanel({
  title,
  subtitle,
  kind,
  levels,
  busyId,
  onAdd,
  onRename,
  onSetDefault,
  onDelete,
}: {
  title: string;
  subtitle: string;
  kind: OptionLevelKind;
  levels: LevelRow[];
  busyId: string | null;
  onAdd: (kind: OptionLevelKind, name: string) => Promise<void>;
  onRename: (level: LevelRow, name: string) => Promise<boolean>;
  onSetDefault: (level: LevelRow) => Promise<void>;
  onDelete: (level: LevelRow) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    await onAdd(kind, name);
    setDraft("");
  }

  async function commitRename(level: LevelRow) {
    const name = editName.trim();
    if (!name || name === level.name) {
      setEditingId(null);
      return;
    }
    const ok = await onRename(level, name);
    if (ok) setEditingId(null);
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-(--line) bg-white">
      <div className="px-[22px] pb-1 pt-5">
        <p className="text-[15px] font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-(--muted)">{subtitle}</p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 px-[22px] pt-4">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a new value…"
          maxLength={80}
          className="h-10 flex-1 rounded-lg border border-(--line) bg-white px-3 text-[12.5px] text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-[#b8762f]/20"
        />
        <button
          type="submit"
          disabled={busyId === `add-${kind}` || !draft.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-(--accent) bg-(--accent) px-4 text-[12.5px] font-semibold text-white transition hover:bg-(--accent-strong) disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconPlus size={15} stroke={2.2} aria-hidden />
          Add
        </button>
      </form>

      <div className="mt-3.5">
        {levels.length === 0 ? (
          <p className="px-[22px] py-8 text-center text-[12.5px] text-(--muted)">
            No values yet — use Install defaults above, or add one here.
          </p>
        ) : (
          levels.map((level) => (
            <div
              key={level.id}
              className="flex items-center gap-2.5 border-b border-(--line) px-[18px] py-3 last:border-b-0"
            >
              {editingId === level.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitRename(level);
                    }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-(--line) bg-white px-2.5 text-[13px] font-semibold text-foreground outline-none focus:border-(--accent)"
                  maxLength={80}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => void onSetDefault(level)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-foreground"
                  title={level.isDefault ? "Default value" : "Double-click to make default"}
                >
                  {level.name}
                </button>
              )}

              {level.isDefault ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-(--accent-strong)">
                  <IconStarFilled size={12} aria-hidden /> default
                </span>
              ) : null}

              {editingId === level.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => void commitRename(level)}
                    disabled={busyId === level.id}
                    className="grid size-8 place-items-center rounded-lg text-(--green) transition hover:bg-(--green-soft) disabled:opacity-50"
                    aria-label={`Save ${level.name}`}
                  >
                    <IconCheck size={16} stroke={2.2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="grid size-8 place-items-center rounded-lg text-(--muted) transition hover:bg-(--surface-tint)"
                    aria-label="Cancel rename"
                  >
                    <IconX size={15} stroke={2} aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(level.id);
                      setEditName(level.name);
                    }}
                    disabled={busyId === level.id}
                    className="grid size-8 place-items-center rounded-lg text-(--muted) transition hover:bg-(--surface-tint) hover:text-foreground disabled:opacity-50"
                    aria-label={`Edit ${level.name}`}
                  >
                    <IconPencil size={16} stroke={1.8} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(level)}
                    disabled={busyId === level.id}
                    className="grid size-8 place-items-center rounded-lg text-(--muted) transition hover:bg-(--red-soft) hover:text-(--red) disabled:opacity-50"
                    aria-label={`Delete ${level.name}`}
                  >
                    <IconTrash size={16} stroke={1.8} aria-hidden />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
