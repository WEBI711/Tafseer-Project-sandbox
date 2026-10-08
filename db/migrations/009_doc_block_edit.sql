-- Reader text edits: an audit trail (who/when/before/after) plus the override
-- itself. Blocks are identified by (source_file, ord) — the reader's block
-- identity — and edits are applied at read time, so every client picks them up
-- on its next fetch without touching the ingested tables.
CREATE TABLE IF NOT EXISTS doc_edit (
    id          SERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    ord         INT NOT NULL,
    old_text    TEXT NOT NULL,
    new_text    TEXT NOT NULL,
    editor      TEXT NOT NULL,
    edited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_edit_block_idx ON doc_edit (source_file, ord, edited_at DESC);
