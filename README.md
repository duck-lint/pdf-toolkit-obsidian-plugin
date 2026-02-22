# PDF Toolkit (Obsidian Plugin)

Desktop-only Obsidian wrapper around the [`pdf-toolkit` CLI](https://github.com/duck-lint/PDF-toolkit).

This plugin is intentionally **thin**: Obsidian provides a small UI (option modals + job panel), while the CLI remains the contract for all real work (outputs + `manifest.json`).

<img width="400" height="600" alt="image" src="https://github.com/user-attachments/assets/81a6ef89-4571-47cd-8bec-f22ef3210723" />

## Why this exists

I built the CLI to keep PDF prep local-first (no subscriptions, no uploading documents to random tools).  
This plugin exists to make that same CLI workflow usable inside Obsidian with minimal friction, while keeping the CLI as the stable contract.

Design choices:
- **CLI-first contract** (the CLI is the source of truth; the plugin just calls it)
- **Outputs stay in-vault** under a per-run folder
- **Audit trail** via CLI-written `manifest.json` per run
- **Lean run history** stored via Obsidian plugin data (kept small + bounded)
- **Outputs** stay in-vault under <run-id>/ + manifest per run

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

