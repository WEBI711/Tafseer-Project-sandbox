"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { EDITOR_HEADER, type Editor } from "@/lib/editor";
import type { DocBlock, ResponseDoc, SurahView, TreeSurah } from "@/lib/types";
import { workLabel } from "./Workspace";
import CommentaryText from "./CommentaryText";

const EDITOR_STORAGE_KEY = "tafseer.editor";

/** Reads the signed-in editor from localStorage; null when signed out. */
function loadEditor(): Editor | null {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITOR_STORAGE_KEY) ?? "null");
    return saved?.name && saved?.key ? saved : null;
  } catch {
    return null;
  }
}

type Props = {
  mode: "reader" | "query";
  surah: SurahView | null;
  doc: ResponseDoc | null;
  ref: RefObject<HTMLElement | null>;
  tree: TreeSurah[];
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onRefreshSurah: () => void;
};

export default function Reader({
  mode,
  surah,
  doc,
  ref,
  tree,
  onToggleLeft,
  onToggleRight,
  onRefreshSurah,
}: Props) {
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => setEditor(loadEditor()), []);

  /** Asks for a name and the shared key; affordances only appear if the
      server accepts the key. */
  const signIn = useCallback(async () => {
    const name = window.prompt("Editor name (recorded with each edit)")?.trim();
    if (!name) return;
    const key = window.prompt("Editor key") ?? "";
    const res = await fetch("/api/editor", { headers: { [EDITOR_HEADER]: key } });
    if (!(await res.json()).authorized) {
      window.alert("That key is not authorized.");
      return;
    }
    const next = { name, key };
    try {
      localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — the editor stays signed in for this session only */
    }
    setEditor(next);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(EDITOR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setEditor(null);
  }, []);
  const crumb =
    mode === "query" && doc
      ? {
          label: (
            <>
              Query / <b>“{doc.query}”</b>
              <span className="count">
                {doc.stats.ayat} ayat · {doc.stats.surahs} surahs · {doc.stats.juz} juz
              </span>
            </>
          ),
        }
      : surah
        ? { label: <>Juz {surah.juz} / Surah {surah.number} / <b>{surah.name_en}</b></> }
        : { label: <>Reading</> };

  return (
    <main className="main" ref={ref}>
      <div className="top">
        <span className="crumb">{crumb.label}</span>
        <span style={{ display: "flex", gap: 8 }}>
          {mode === "reader" && (
            <button
              className={`icon-btn${editor ? " active" : ""}`}
              onClick={editor ? signOut : signIn}
              title={editor ? `Editing as ${editor.name} — click to sign out` : "Sign in as editor"}
            >
              {editor ? "✎" : "🔒"}
            </button>
          )}
          <button className="icon-btn" onClick={onToggleLeft} title="Toggle explorer">
            ☰
          </button>
          <button className="icon-btn" onClick={onToggleRight} title="Toggle chat">
            💬
          </button>
        </span>
      </div>

      <div className="wrap">
        {mode === "query"
          ? doc && <ResponseDocument doc={doc} tree={tree} />
          : surah && <SurahDocument surah={surah} editor={editor} onRefresh={onRefreshSurah} />}
      </div>
    </main>
  );
}

/* ---------------- shared commentary rendering ---------------- */

type Row = { id: number; content: string; source_file: string | null };

/**
 * Consecutive passages from one file form a run. A run is only labelled when
 * the block itself mixes files — 95% of ayat come from a single docx.
 */
function CommentaryRows({ rows, labelRuns }: { rows: Row[]; labelRuns?: boolean }) {
  const runs: { file: string | null; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = runs[runs.length - 1];
    if (last && last.file === r.source_file) last.rows.push(r);
    else runs.push({ file: r.source_file, rows: [r] });
  }
  return (
    <>
      {runs.map((run, ri) => (
        <div className="run" key={ri}>
          {labelRuns && <span className="src">Source · {workLabel(run.file)}</span>}
          {run.rows.map((r, i) => (
            <CommentaryText key={r.id || i} content={r.content} />
          ))}
        </div>
      ))}
    </>
  );
}

/* ---------------- reader mode: the source document, block by block ---------------- */

function SurahDocument({
  surah,
  editor,
  onRefresh,
}: {
  surah: SurahView;
  editor: Editor | null;
  onRefresh: () => void;
}) {
  const multi = surah.documents.length > 1;
  return (
    <>
      {surah.documents.map((doc, i) => (
        <section className="doc" key={doc.source_file} id={`doc-${i}`}>
          {/* app chrome, not document text: keep attribution when a surah is
              covered by more than one source file */}
          {multi && <div className="doc-source">Source · {workLabel(doc.source_file)}</div>}
          <DocumentBody
            blocks={doc.blocks}
            sourceFile={doc.source_file}
            editor={editor}
            onRefresh={onRefresh}
          />
        </section>
      ))}
    </>
  );
}

function DocumentBody({
  blocks,
  sourceFile,
  editor,
  onRefresh,
}: {
  blocks: DocBlock[];
  sourceFile: string;
  editor: Editor | null;
  onRefresh: () => void;
}) {
  const out: React.ReactNode[] = [];
  let list: DocBlock[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    out.push(
      <ul className="doc-list" key={`list-${list[0].ord}`}>
        {list.map((b) => (
          <li key={b.ord} data-kind={b.kind} data-ord={b.ord}>
            <EditableBlock block={b} sourceFile={sourceFile} editor={editor} onRefresh={onRefresh}>
              {b.text}
            </EditableBlock>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const b of blocks) {
    if (b.kind === "list_item") {
      list.push(b);
      continue;
    }
    flushList();
    out.push(
      <EditableBlock key={b.ord} block={b} sourceFile={sourceFile} editor={editor} onRefresh={onRefresh}>
        <BlockView block={b} />
      </EditableBlock>,
    );
    // section headings take the demo's ornamental rule underneath
    if (b.kind === "section_heading") {
      out.push(
        <div className="orn" key={`orn-${b.ord}`}>
          <span>۞</span>
        </div>,
      );
    }
  }
  flushList();
  return <>{out}</>;
}

/**
 * Inline edit affordance: for the signed-in editor each block gets a hover
 * pencil that turns it into a textarea. Saving stores the new text on the
 * server and refreshes the view, so all clients pick the edit up.
 */
function EditableBlock({
  block,
  sourceFile,
  editor,
  onRefresh,
  children,
}: {
  block: DocBlock;
  sourceFile: string;
  editor: Editor | null;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);
  const [busy, setBusy] = useState(false);

  // tables store a JSON grid, not prose — leave them read-only
  if (!editor || block.kind === "table") return <>{children}</>;

  const save = async () => {
    const after = draft.trim();
    if (!after || after === block.text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/doc-block", {
        method: "PUT",
        headers: { "Content-Type": "application/json", [EDITOR_HEADER]: editor.key },
        body: JSON.stringify({
          sourceFile,
          kind: block.kind,
          text: block.text,
          after,
          editor: editor.name,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      onRefresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`editable${editing ? " editing" : ""}`}>
      {children}
      {editing ? (
        <span className="edit-actions">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(draft.split("\n").length + 1, 10)}
            autoFocus
          />
          <button className="edit-act" onClick={save} disabled={busy}>
            Save
          </button>
          <button
            className="edit-act"
            onClick={() => {
              setDraft(block.text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          className="edit-btn"
          onClick={() => {
            setDraft(block.text);
            setEditing(true);
          }}
          title="Edit text"
        >
          ✎
        </button>
      )}
    </div>
  );
}

function BlockView({ block }: { block: DocBlock }) {
  const sectionAnchor = block.section_id ? `sec-${block.section_id}` : undefined;
  const ayahAnchor =
    block.kind === "translation" && block.ref_ayah
      ? `ayah-${block.ref_surah}-${block.ref_ayah}`
      : undefined;
  const id = sectionAnchor ?? ayahAnchor;
  const meta = { "data-kind": block.kind, "data-ord": block.ord };

  switch (block.kind) {
    case "juz_header":
      return (
        <div className="doc-juz" id={id} {...meta}>
          {block.text}
        </div>
      );
    case "surah_header":
      return (
        <h1 className="doc-surah" id={id} {...meta}>
          {block.text}
        </h1>
      );
    case "section_heading":
      return (
        <h2 className="section" id={id} {...meta}>
          {block.text}
        </h2>
      );
    case "heading":
      return (
        <h3 className="doc-heading" id={id} {...meta}>
          {block.text}
        </h3>
      );
    case "arabic":
      return (
        <p className="ar" dir="rtl" id={id} {...meta}>
          {block.text}
        </p>
      );
    case "translation":
      return (
        <p className="translation" id={id} {...meta}>
          {block.text}
        </p>
      );
    case "table":
      return <TableBlock block={block} id={id} meta={meta} />;
    default:
      return (
        <CommentaryText
          content={block.text}
          id={id}
          dataKind={block.kind}
          dataOrd={block.ord}
        />
      );
  }
}

function TableBlock({
  block,
  id,
  meta,
}: {
  block: DocBlock;
  id?: string;
  meta: Record<string, string | number>;
}) {
  // Cells are stored as a JSON grid so the table the author wrote survives.
  let rows: string[][] = [];
  try {
    const parsed = JSON.parse(block.text);
    if (Array.isArray(parsed)) rows = parsed.map((r) => (Array.isArray(r) ? r : [String(r)]));
  } catch {
    rows = [[block.text]];
  }
  if (rows.length === 0) return null;
  const [head, ...body] = rows;

  return (
    <div className="doc-table-wrap" id={id} {...meta}>
      <table className="doc-table">
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- query-response mode (QUERY-VIEW.md contract) ---------------- */

function ResponseDocument({ doc, tree }: { doc: ResponseDoc; tree: TreeSurah[] }) {
  const sources = new Set(
    doc.groups.flatMap((g) => g.ayat.flatMap((a) => a.commentary.map((c) => c.source_file))),
  );
  if (doc.groups.length === 0) {
    return (
      <>
        <div className="kicker">Query response</div>
        <h1>“{doc.query}”</h1>
        <p className="lede">
          No passage in the corpus matches this query closely enough to render a
          response document.
        </p>
      </>
    );
  }
  return (
    <>
      <div className="kicker">Query response · rendered from {sources.size} tafsir works</div>
      <h1>{doc.query}</h1>
      <p className="lede">
        Every ayah the corpus connects to this question — ordered through the Book
        itself, with the commentary that surrounds each verse kept intact.
      </p>
      <div className="meta">
        <div>
          Matches<br />
          <b>{doc.stats.ayat} ayat</b>
        </div>
        <div>
          Juz<br />
          <b>{doc.stats.juz}</b>
        </div>
        <div>
          Surahs<br />
          <b>{doc.stats.surahs}</b>
        </div>
        <div>
          Order<br />
          <b>Canonical</b>
        </div>
      </div>

      {doc.groups.map((g) => {
        const surahMeta = tree.find((s) => s.number === g.surah);
        const juzAyat = doc.groups
          .filter((x) => x.juz === g.juz)
          .reduce((n, x) => n + x.ayat.length, 0);
        return (
          <div key={`${g.juz}-${g.surah}`}>
            <div className="juz-band">
              <div className="jl">Juz {g.juz}</div>
              <div className="jn">{g.juz_ar}</div>
              <div className="st">
                {g.name_en} · {g.continued ? "continued · " : ""}
                {juzAyat} ayat matched
              </div>
            </div>

            {!g.continued && (
              <div className="surah-head">
                <span className="sn">
                  Surah {g.surah} · {g.name_en}
                </span>
                <span className="ss">{surahMeta?.ayat ?? 0} ayat</span>
              </div>
            )}

            {g.ayat.map((a) => (
              <AyahBlock
                key={`${g.surah}-${a.number}`}
                id={`ayah-${g.surah}-${a.number}`}
                ref_={`${g.surah}:${a.number}${a.section_title ? ` · ${a.section_title}` : ""}`}
                score={a.score}
                labelRuns={new Set(a.commentary.map((c) => c.source_file)).size > 1}
                number={a.number}
                text_ar={a.text_ar}
                translation={a.translation}
                commentary={a.commentary.map((c) => ({
                  id: 0,
                  content: c.content,
                  source_file: c.source_file,
                }))}
              />
            ))}
          </div>
        );
      })}

      <div className="endmark">
        ۞
        <small>End of response · {doc.stats.ayat} ayat</small>
      </div>
    </>
  );
}

/* ---------------- shared ayah block ---------------- */

function AyahBlock({
  id,
  number,
  text_ar,
  translation,
  commentary,
  ref_,
  score,
  labelRuns = false,
}: {
  id: string;
  number: number;
  text_ar: string | null;
  translation: string | null;
  commentary: Row[];
  ref_?: string;
  score?: number;
  highlight?: boolean;
  labelRuns?: boolean;
}) {
  return (
    <div className="ayah" id={id}>
      {ref_ !== undefined && (
        <div className="vhead">
          <span className="ref">{ref_}</span>
          {score !== undefined && <span className="score">{score.toFixed(2)}</span>}
        </div>
      )}
      <div className="vrow">
        <span className="ayah-n">{number}</span>
        {/* Blank means the source doc quotes no Arabic for this ayah — it is
            never borrowed from a neighbour. */}
        {text_ar && (
          <p className="ar" dir="rtl">
            {text_ar}
          </p>
        )}
      </div>
      <div className="body">
        {translation && <p className="translation">{translation}</p>}
        {commentary.length > 0 && (
          <div className="commentary">
            <CommentaryRows rows={commentary} labelRuns={labelRuns} />
          </div>
        )}
      </div>
    </div>
  );
}