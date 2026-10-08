"use client";

import { useEffect, useRef, useState } from "react";
import type { TakeawaysView, TreeSurah } from "@/lib/types";

type Props = {
  tree: TreeSurah[];
  active: { surah?: number; sectionId?: number };
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onOpenSurah: (number: number, juz: number, sectionId?: number) => void;
  onCollapse: () => void;
};

export default function Explorer({
  tree,
  active,
  expanded,
  onToggle,
  onOpenSurah,
  onCollapse,
}: Props) {
  // Takeaways panels are local to the explorer: lazily fetched on first
  // open, then cached, keyed per juz part (a surah that spans juz has a
  // recap per part). `missing` marks surahs with no takeaways at all.
  const [recaps, setRecaps] = useState<Record<string, TakeawaysView>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [openTakeaways, setOpenTakeaways] = useState<Set<string>>(new Set());
  const requested = useRef(new Set<string>());

  const toggleTakeaways = (key: string) => {
    setOpenTakeaways((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Fetch once per open panel; 404 means the surah has no takeaways yet.
  useEffect(() => {
    for (const key of openTakeaways) {
      if (requested.current.has(key) || recaps[key] || missing.has(key)) continue;
      requested.current.add(key);
      const surah = Number(key.split(":")[2]);
      fetch(`/api/takeaways/${surah}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: TakeawaysView | null) => {
          if (data) setRecaps((prev) => ({ ...prev, [key]: data }));
          else setMissing((prev) => new Set(prev).add(key));
        })
        .catch(() => requested.current.delete(key));
    }
  }, [openTakeaways, recaps, missing]);

  const juzGroups = tree.reduce<Record<number, TreeSurah[]>>((acc, s) => {
    (acc[s.juz] ??= []).push(s);
    return acc;
  }, {});

  return (
    <aside className="side">
      <div className="head">
        <span className="brand">Tafseer</span>
        <button className="icon-btn" onClick={onCollapse} title="Hide explorer">
          ‹
        </button>
      </div>
      <div className="scroll">
        {Object.entries(juzGroups).map(([juz, surahs]) => {
          const juzKey = `juz:${juz}`;
          const juzOpen = expanded.has(juzKey);
          return (
            <div key={juz} className={`node${juzOpen ? "" : " closed"}`}>
              <div className="row" onClick={() => onToggle(juzKey)}>
                <span className="caret">▾</span>
                <span className="jt">Juz {juz}</span>
                <small>{surahs.length} surahs</small>
              </div>
              <div className="kids">
                {surahs.map((s) => {
                  // Per-juz key: the same surah can span several juz, and each
                  // part must expand independently.
                  const surahKey = `surah:${juz}:${s.number}`;
                  const surahOpen = expanded.has(surahKey);
                  const isActive = active.surah === s.number;
                  return (
                    <div key={s.number} className={`node${surahOpen ? "" : " closed"}`}>
                      <div
                        className={`row${isActive ? " on" : ""}`}
                        onClick={() => {
                          // Collapsing the active surah should stay collapsed,
                          // so don't re-open it in the reader on this click.
                          if (surahOpen && isActive) {
                            onToggle(surahKey);
                            return;
                          }
                          if (!surahOpen) onToggle(surahKey);
                          onOpenSurah(s.number, s.juz);
                        }}
                      >
                        <span className="caret">▾</span>
                        <span>Surah {s.number}
                          {s.continued ? " · continued" : ` · ${shortName(s.name_en)}`}
                        </span>
                        <small>{s.ayat}</small>
                      </div>
                      <div className="kids">
                        <button
                          className="item sub"
                          onClick={() => toggleTakeaways(`takeaways:${juz}:${s.number}`)}
                        >
                          <span>Key takeaways</span>
                          <small>✦</small>
                        </button>
                        {openTakeaways.has(`takeaways:${juz}:${s.number}`) && (
                          <TakeawaysPanel
                            view={recaps[`takeaways:${juz}:${s.number}`]}
                            missing={missing.has(`takeaways:${juz}:${s.number}`)}
                            juz={Number(juz)}
                          />
                        )}
                        {s.sections.map((sec) => (
                          <button
                            key={sec.id}
                            className={`item sub${
                              active.sectionId === sec.id ? " on" : ""
                            }`}
                            onClick={() => onOpenSurah(s.number, s.juz, sec.id)}
                          >
                            <span>{titleCase(sec.title)}</span>
                            <small>
                              {sec.from_ayah != null
                                ? `${s.number}:${sec.from_ayah}${
                                    sec.to_ayah && sec.to_ayah !== sec.from_ayah
                                      ? `–${sec.to_ayah}`
                                      : ""
                                  }`
                                : ""}
                            </small>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {tree.length === 0 && <p className="hint">Loading the tree…</p>}
      </div>
    </aside>
  );
}

/**
 * The author's own end-of-part recap ("MY KEY TAKEAWAYS"), shown in place in
 * the tree. Fixed content — read straight from the ingested recap table.
 */
function TakeawaysPanel({
  view,
  missing,
  juz,
}: {
  view?: TakeawaysView;
  missing: boolean;
  juz: number;
}) {
  if (!view) return <p className="hint">{missing ? "No takeaways in this juz yet." : "Loading takeaways…"}</p>;
  const mine = view.recaps.filter((r) => r.juz === juz);
  if (mine.length === 0) return <p className="hint">No takeaways in this juz yet.</p>;
  return (
    <div className="takeaways">
      {mine.map((r, i) => (
        <div key={i}>
          {r.title && <strong>{titleCase(r.title)}</strong>}
          {r.items.map((it, j) => (
            <p key={j} className={it.kind === "list_item" ? "li" : undefined}>
              {it.text}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "AL BAQARA (THE COW)" -> "Al Baqara" — keep the author's words, shorten. */
function shortName(s: string) {
  return titleCase(s.split("(")[0].trim());
}

/** Section titles come from the author as ALL CAPS — keep the words, soften case. */
function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s(\[“‘-])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());
}