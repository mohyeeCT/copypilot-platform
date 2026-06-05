# Import Hardening Design

## Goal

Make CSV uploads and bulk-pasted spreadsheet data behave consistently across FAQ, Intro, Meta, Page Copy, and All In One without changing backend APIs, job payloads, or the existing editable row tables.

## Scope

The change is limited to:

- one shared import parser;
- one compact rejected-row error list;
- the import handlers in the five existing new-job screens;
- focused automated tests and existing project verification.

It does not add packages, routes, database fields, backend changes, import previews, or broader UI redesigns.

## Import Contract

Both uploaded CSV files and pasted text are read as text and passed through the same PapaParse-based utility. PapaParse auto-detects supported delimiters, including commas and tabs.

The parser:

- preserves intentionally blank cells and their column positions;
- supports quoted commas, escaped quotation marks, and quoted multiline values;
- removes only completely empty rows;
- trims surrounding whitespace from individual values;
- does not rewrite optional field content;
- requires the URL field to begin with `http://` or `https://`;
- keeps valid rows even when other rows are rejected.

## Headers

The first populated row is treated as a header only when it contains a recognized URL header and every other populated cell is also a recognized header alias. This supports a one-column `url` file while preventing an ordinary data row from being removed accidentally. Recognized aliases are matched case-insensitively after trimming and normalizing spaces, hyphens, and underscores.

Shared aliases include:

- URL: `url`, `page url`, `link`
- Keyword: `keyword`, `primary keyword`, `keyword seeds`
- Page type: `page type`, `page_type`, `type`, `template`
- H1: `h1`, `h1 tag`
- Template key: `template key`, `template_key`

When no recognized header is detected, values are mapped positionally according to the selected app schema. Unrecognized first rows are never silently removed.

## App Schemas

- FAQ: `url`, `keyword`, `page_type`, `h1`; default page type `general`
- Intro: `url`, `keyword`, `page_type`, `h1`; default page type `service_lp`
- Meta: `url`, `keyword`, `page_type`, `h1`; default page type `general`
- Page Copy: `url`, `keyword`, `page_type`, `h1`, `template_key`; defaults supplied by the current screen settings
- All In One: `url`, `keyword`, `page_type`, `h1`; defaults supplied by the current screen settings and output toggles

Optional fields remain blank when blank in the source. Defaults are applied only where the existing screens already apply them, such as page type, template key, or output toggles.

## Rejected Rows

The parser returns accepted rows and rejected rows separately. Each rejected row includes:

- the original one-based source row number;
- one or more clear reasons;
- the parsed source values for diagnostics.

Malformed CSV parser errors are associated with their source row where PapaParse supplies a row number. Rows with missing or non-HTTP(S) URLs are rejected. Valid neighboring rows are still imported.

Each new-job screen displays a compact rejected-row list near its import controls. Import errors replace the previous import attempt's errors when the user parses or uploads again.

## Data Flow

1. File upload reads `file.text()`; paste input already provides text.
2. The screen calls the shared parser with its app schema and current defaults.
3. The shared parser returns accepted rows and rejected rows.
4. The screen maps accepted rows into its existing `Row` type and existing defaults.
5. The screen updates the current editable row table and displays rejected rows.
6. Existing submission behavior and payload construction remain unchanged.

## Testing

Focused parser tests cover:

- comma-delimited and tab-delimited input;
- intentionally blank cells;
- quoted commas and escaped quotation marks;
- quoted multiline values;
- recognized header removal;
- positional input without headers;
- unrecognized first rows;
- invalid and missing URLs;
- malformed CSV;
- app-specific aliases and defaults.

Project verification includes focused tests, linting, TypeScript checks, production build, and a final diff review confirming only scoped files changed.
