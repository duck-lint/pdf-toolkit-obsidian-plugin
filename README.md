# PDF Toolkit (Obsidian Plugin)

Desktop-only Obsidian wrapper around the [`pdf-toolkit` CLI](https://github.com/duck-lint/PDF-toolkit).

This plugin is intentionally **thin**: Obsidian provides a small UI (option modals + job panel), while the CLI remains the contract for all real work (outputs + `manifest.json`).

## Why this exists (implementation lens)

PDF handling is a classic “paper cut” workflow: rotate a few pages, split a file, render to images, crop/split spreads, and keep outputs organized. The value isn’t fancy UI — it’s **repeatability**, **predictable outputs**, and **handoff-friendly artifacts**.

Design choices:
- **CLI-first contract** (the CLI is the source of truth; the plugin just calls it)
- **Outputs stay in-vault** under a per-run folder
- **Audit trail** via CLI-written `manifest.json` per run
- **Lean run history** stored via Obsidian plugin data (kept small + bounded)

---

## What it does

- Runs `pdf-toolkit` as a subprocess (Obsidian Desktop / Electron only).
- Writes outputs inside the vault under:  
  `pdf-toolkit_Output/<run-id>/` (configurable)
- Reads the CLI-written `manifest.json` as the authoritative record of what happened.
- Shows a Jobs panel with recent runs, status, and stdout/stderr tails.

---

## Commands (Command Palette)

- **Render active PDF to images...**
- **Rotate active PDF pages...**
- **Split active PDF into parts...**
- **Split spreads + crop images in folder...**
- **Open Jobs panel**

---

## Typical scan/OCR prep flow

1) Open the PDF in Obsidian  
2) Run **Render active PDF to images...**  
3) Run **Split spreads + crop images in folder...** and select the rendered image folder  
4) Outputs are written to `pdf-toolkit_Output/<run-id>/` with a `manifest.json` per run

---

## Requirements

- Obsidian **Desktop** (this plugin spawns subprocesses; mobile is not supported)
- A working `pdf-toolkit` installation (either `pdf-toolkit.exe` or `python -m pdf-toolkit`)

---

## Install (manual / dev)

This repo is set up for local development (not packaged for the community store).

1) Build:

```bash
npm i
npm run build
````

2. Copy these files into your vault:

* `main.js`
* `manifest.json`
* `styles.css` (optional)

Target folder:

`<your-vault>/.obsidian/plugins/pdf-toolkit/`

3. Restart Obsidian (or reload plugins) and enable **PDF Toolkit**.

---

## Configuration (Obsidian Settings → Community Plugins → PDF Toolkit)

### CLI command

Prefer an explicit per-vault path (no PATH assumptions).

Option A: installed entrypoint (Windows example)

* `CLI command`: `C:\path\to\venv\Scripts\pdf-toolkit.exe`
* `CLI args prefix`: *(blank)*

Option B: module invocation

* `CLI command`: `C:\path\to\venv\Scripts\python.exe`
* `CLI args prefix`: `-m pdf-toolkit`

### Output root folder (vault-relative)

Default: `pdf-toolkit_Output`

All runs go to:
`<outputRoot>/<run-id>/`

### Default verbosity

Maps to CLI flags:

* quiet → `--quiet`
* normal → *(no flag)*
* verbose → `--verbose`

### Reveal output folder after success

If enabled, the plugin opens the run output folder in your OS file explorer.

---

## Run artifacts

Each run produces:

* A run folder: `pdf-toolkit_Output/<run-id>/...`
* A CLI-written `manifest.json` inside that folder
* A job entry stored via Obsidian plugin data (recent runs only; kept bounded)

The job record includes:

* command args
* status + exit code
* input path (when relevant)
* output folder + manifest path
* last chunk of stdout/stderr (useful for debugging without scrolling a terminal)

---

## Troubleshooting

* **“Set the CLI command path…”**
  You haven’t configured `CLI command` yet (Settings → PDF Toolkit).

* **Command runs in terminal but not in Obsidian**
  Use an explicit `CLI command` path (don’t rely on PATH).
  If using `python -m pdf-toolkit`, make sure the Python you point at has `pdf-toolkit` installed.

* **Nothing happens / no output**
  Open the **Jobs panel** → check stderr tail + exit code.
  Also try setting verbosity to **verbose** to surface more CLI logging.

---

## Development notes

* The plugin uses small “option modals” for the handful of knobs needed in practice.
* The CLI remains the contract to keep behavior consistent across:

  * direct terminal usage
  * scripts/automation
  * Obsidian UI calls

---

## License

MIT (or update if different)

````

Now, for the “other pinned repo README” (your OCR pipeline): I don’t have that repo contents attached in this chat, so I can’t truthfully “review” it line-by-line — but I *can* give you a job-facing README template that matches the toolchain story and won’t accidentally sound like a dev diary. Paste + adjust only what’s true.

```markdown
# OCR → Markdown Pipeline (CLI-first)

Local, repeatable OCR pipeline that turns page images into cleaned Markdown suitable for knowledge workflows (e.g., Obsidian), with debug artifacts to make failures inspectable.

This is designed like an implementation tool: predictable inputs/outputs, explicit configuration, and artifacts that survive handoffs.

## Where it fits

Typical flow:
1) Prep PDF → page images (see `PDF-toolkit`)
2) OCR page images → text
3) Normalize/clean → Markdown
4) Emit outputs + debug artifacts for traceability

## Features (edit to match what’s true)

- CLI-first execution (scriptable + automatable)
- Deterministic output folders and naming
- Optional “cleaning” stage (normalize whitespace, fix hyphenation, etc.)
- Debug artifacts (intermediate images/logs/JSON) to understand OCR failures
- Safe-by-default flags (dry-run / overwrite / max-files), where relevant

## Quickstart

```bash
# example — replace with your real command(s)
python -m ocr_obsidian run --in_dir "out/pages_single" --out_dir "out/md" --debug
````

## Inputs / Outputs

Inputs:

* A folder of page images (PNG/JPG)
* (Optional) config file(s)

Outputs:

* Markdown files (one-per-page or one-per-section — whichever you do)
* Debug folder (if enabled)
* Run log / manifest (if you produce one)

## Design principles

* Make failures inspectable (debug artifacts > silent “best effort”)
* Prefer explicit configuration and predictable naming
* Keep the contract stable (CLI usable from terminal, scripts, or a thin UI wrapper)

## Requirements

* Python 3.x
* OCR engine(s): (list what you actually use)
* Any optional deps

