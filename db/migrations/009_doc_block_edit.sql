-- Audit trail for reader edits to the source document: who changed a
-- doc_block's text, when, and what it was before and after. The editing
-- endpoint updates doc_block.text itself; the reader applies these rows over
-- its derived view so every client's next fetch shows the current text.
CREATE TABLE IF NOT EXISTS doc_block_edit (
    id          SERIAL PRIMARY KEY,
    block_id    INT NOT NULL REFERENCES doc_block(id),
    editor      TEXT NOT NULL,   -- display name of the designated editor
    text_before TEXT NOT NULL,
    text_after  TEXT NOT NULL,
    edited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_block_edit_block_idx ON doc_block_edit (block_id);
