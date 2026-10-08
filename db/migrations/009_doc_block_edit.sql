-- Audit trail for reader edits to the source document: who changed a block's
-- text, when, and what it was before and after. The reader's blocks are
-- derived (part / section / ayah_unit / commentary_item, see 007), so an edit
-- is recorded against the text as shown; surahView applies these rows over the
-- derived view so every client's next fetch shows the current text.
CREATE TABLE IF NOT EXISTS doc_block_edit (
    id          SERIAL PRIMARY KEY,
    source_file TEXT NOT NULL,
    kind        TEXT NOT NULL,
    text_before TEXT NOT NULL,
    text_after  TEXT NOT NULL,
    editor      TEXT NOT NULL,   -- display name of the designated editor
    edited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_block_edit_file_idx ON doc_block_edit (source_file);
