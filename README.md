# PDF Toolkit (Obsidian plugin)

Thin Obsidian desktop wrapper around the `pdf-toolkit` CLI. (https://github.com/duck-lint/PDF-toolkit)

## What this plugin does
- Runs `pdf-toolkit` as a subprocess.
- Writes outputs inside the vault under `pdf-toolkit_Output/<run-id>/`.
- Reads the CLI-written `manifest.json` as the source of truth.
- Keeps a lightweight run index at `.obsidian/pdf-toolkit-jobs.json`.

## Commands
- `Render active PDF to images...`
- `Rotate active PDF pages...`
- `Split active PDF into parts...` (PDF chunking via CLI `split`)
- `Split spreads + crop images in folder...` (image processing via CLI `page-images`)

## Typical scan flow
1. Run `Render active PDF to images...` to generate page images from a scan PDF.
2. Run `Split spreads + crop images in folder...` and select the rendered image folder.
3. The plugin writes results to `pdf-toolkit_Output/<run-id>/` and records `manifest.json`.

## Setup
1. Install/build the plugin into your vault at:
   `.obsidian/plugins/pdf-toolkit/`
2. In Obsidian Settings -> Community Plugins -> PDF Toolkit:
   - Set `CLI command` to the full path of your `pdf-toolkit` entrypoint.
   - Example (Windows): `C:\\...\\venv\\Scripts\\pdf-toolkit.exe`
   - If using `python -m pdf-toolkit`, set `CLI command` to `...\\python.exe` and `CLI args prefix` to `-m pdf-toolkit`.

## Build
- `npm i`
- `npm run build`

Copy these files into your vault plugin folder:
- `main.js`
- `manifest.json`
- `styles.css` (optional)

## Notes
- Desktop only: running subprocesses is not supported on mobile.
