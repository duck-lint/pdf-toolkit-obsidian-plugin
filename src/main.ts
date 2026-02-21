import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { makeRunId, runPdfToolkit } from "./cli";
import { JobRecord, JobsStore } from "./jobsStore";
import { DEFAULT_SETTINGS, PdfToolkitSettings, PdfToolkitSettingTab } from "./settings";
import { JobsView, JOBS_VIEW_TYPE } from "./ui/JobsView";
import { PageImagesRunModal } from "./ui/modals/PageImagesRunModal";
import { RenderOptionsModal } from "./ui/modals/RenderOptionsModal";
import { RotateOptionsModal } from "./ui/modals/RotateOptionsModal";
import { SplitOptionsModal } from "./ui/modals/SplitOptionsModal";

// Obsidian desktop ships with Electron; safe to require at runtime.
// (This plugin is desktop-only anyway because it spawns subprocesses.)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const electron = require("electron");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
const OUTPUT_TAIL_LIMIT = 20_000;

export default class PdfToolkitPlugin extends Plugin {
  settings!: PdfToolkitSettings;
  jobs!: JobsStore;
  private pageImagesFlowRunning = false;

  async onload() {
    await this.loadSettings();

    this.jobs = new JobsStore(this);

    this.registerView(JOBS_VIEW_TYPE, (leaf) => new JobsView(leaf, this));
    this.addSettingTab(new PdfToolkitSettingTab(this.app, this));

    this.addCommand({
      id: "open-jobs",
      name: "Open Jobs panel",
      callback: async () => {
        const leaf =
          this.app.workspace.getRightLeaf(false)
          ?? this.app.workspace.getRightLeaf(true)
          ?? this.app.workspace.getLeaf(true);
        if (!leaf) return;
        await leaf.setViewState({ type: JOBS_VIEW_TYPE, active: true });
      },
    });

    this.addCommand({
      id: "render-active-pdf",
      name: "Render active PDF to images...",
      callback: async () => this.renderActivePdf(),
    });

    this.addCommand({
      id: "split-active-pdf",
      name: "Split active PDF into parts...",
      callback: async () => this.splitActivePdf(),
    });

    this.addCommand({
      id: "page-images-folder",
      name: "Split spreads + crop images in folder...",
      callback: async () => this.pageImagesInFolder(),
    });

    this.addCommand({
      id: "rotate-active-pdf",
      name: "Rotate active PDF pages...",
      callback: async () => this.rotateActivePdf(),
    });
  }

  onunload() {}

  async loadSettings() {
    const raw = await this.loadData();
    const data =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    // Jobs are stored separately in plugin data under `jobs`.
    const { jobs: _jobs, ...settingsData } = data;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsData);
  }

  async saveSettings() {
    const raw = await this.loadData();
    const data =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    await this.saveData({ ...data, ...this.settings });
  }

  private ensureCliConfigured(): boolean {
    if (!this.settings.cliCommand || !this.settings.cliCommand.trim()) {
      new Notice("PDF Toolkit: set the CLI command path in plugin settings first.");
      return false;
    }
    return true;
  }

  private ensureActivePdf(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension.toLowerCase() !== "pdf") {
      new Notice("Open a PDF file first.");
      return null;
    }
    return file;
  }

  private runOutputDir(runId: string): string {
    return normalizePath(`${this.settings.outputRoot}/${runId}`);
  }

  private manifestPath(runId: string): string {
    return normalizePath(`${this.runOutputDir(runId)}/manifest.json`);
  }

  private vaultBasePath(): string {
    return (this.app.vault.adapter as any).basePath as string;
  }

  private toAbs(vaultRel: string): string {
    return path.join(this.vaultBasePath(), vaultRel);
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const target = normalizePath(folderPath);
    const parts = target.split("/").filter(Boolean);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (await this.app.vault.adapter.exists(current)) continue;
      try {
        await this.app.vault.createFolder(current);
      } catch {
        if (!(await this.app.vault.adapter.exists(current))) {
          throw new Error(`Unable to create folder: ${current}`);
        }
      }
    }
  }

  private async recordJob(job: JobRecord) {
    try {
      await this.jobs.upsert(job);
    } catch (err) {
      console.error("PDF Toolkit: failed to record job", err);
    }

    try {
      // refresh jobs view if open
      const leaves = this.app.workspace.getLeavesOfType(JOBS_VIEW_TYPE);
      for (const leaf of leaves) {
        // @ts-ignore
        await leaf.view.render?.();
      }
    } catch (err) {
      console.error("PDF Toolkit: failed to refresh Jobs view", err);
    }
  }

  private async revealOutputDir(outDir: string): Promise<void> {
    if (!this.settings.revealAfterSuccess) return;
    try {
      const abs = this.toAbs(outDir);
      await electron.shell.openPath(abs);
    } catch {
      // non-fatal
    }
  }

  private tailText(value: string): string {
    if (value.length <= OUTPUT_TAIL_LIMIT) return value;
    return value.slice(-OUTPUT_TAIL_LIMIT);
  }

  private async executeJob(
    job: JobRecord,
    args: string[],
    successNotice: string,
    failureNotice: string
  ): Promise<void> {
    await this.recordJob(job);
    const result = await runPdfToolkit(this.app, this.settings, args, this.settings.defaultVerbosity);

    job.endedAt = Date.now();
    job.exitCode = result.exitCode;
    job.stdoutTail = this.tailText(result.stdout);
    job.stderrTail = this.tailText(result.stderr);
    job.status = result.exitCode === 0 ? "ok" : "error";
    if (job.status === "error") {
      job.error = result.stderr.trim().slice(-2000);
    } else {
      delete job.error;
    }
    await this.recordJob(job);

    if (job.status === "ok") {
      const adapter: any = this.app.vault.adapter;
      if (typeof adapter.reconcileChanges === "function") {
        try {
          await adapter.reconcileChanges();
        } catch {
          // non-fatal
        }
      }
      new Notice(successNotice);
      if (job.outputDir) {
        await this.revealOutputDir(job.outputDir);
      }
    } else {
      new Notice(failureNotice);
    }
  }

  private async renderActivePdf() {
    if (!this.ensureCliConfigured()) return;
    const pdf = this.ensureActivePdf();
    if (!pdf) return;

    const options = await RenderOptionsModal.open(this.app);
    if (!options) return;

    const runId = makeRunId();
    const outDir = this.runOutputDir(runId);
    const manifest = this.manifestPath(runId);
    const absPdf = this.toAbs(pdf.path);
    const absOutDir = this.toAbs(outDir);
    const absManifest = this.toAbs(manifest);

    try {
      await this.ensureFolderExists(outDir);
    } catch {
      new Notice("Could not create output folder in the vault.");
      return;
    }

    const args = [
      "render",
      "--pdf", absPdf,
      "--out_dir", absOutDir,
      "--manifest", absManifest,
      "--dpi", String(options.dpi),
    ];
    if (options.pages) args.push("--pages", options.pages);
    if (options.overwrite) args.push("--overwrite");

    const job: JobRecord = {
      id: runId,
      startedAt: Date.now(),
      command: [this.settings.cliCommand, ...this.settings.cliArgsPrefix, ...args],
      inputPath: pdf.path,
      outputDir: outDir,
      manifestPath: manifest,
    };

    await this.executeJob(job, args, "Render complete.", "Render failed (see Jobs).");
  }

  private async splitActivePdf() {
    if (!this.ensureCliConfigured()) return;
    const pdf = this.ensureActivePdf();
    if (!pdf) return;

    const options = await SplitOptionsModal.open(this.app);
    if (!options) return;

    const runId = makeRunId();
    const outDir = this.runOutputDir(runId);
    const manifest = this.manifestPath(runId);
    const absPdf = this.toAbs(pdf.path);
    const absOutDir = this.toAbs(outDir);
    const absManifest = this.toAbs(manifest);

    try {
      await this.ensureFolderExists(outDir);
    } catch {
      new Notice("Could not create output folder in the vault.");
      return;
    }

    const args = [
      "split",
      "--pdf", absPdf,
      "--out_dir", absOutDir,
      "--manifest", absManifest,
    ];
    if (options.strategy === "ranges" && options.ranges) {
      args.push("--ranges", options.ranges);
    }
    if (options.strategy === "pages_per_file" && options.pagesPerFile) {
      args.push("--pages_per_file", String(options.pagesPerFile));
    }
    if (options.overwrite) args.push("--overwrite");

    const job: JobRecord = {
      id: runId,
      startedAt: Date.now(),
      command: [this.settings.cliCommand, ...this.settings.cliArgsPrefix, ...args],
      inputPath: pdf.path,
      outputDir: outDir,
      manifestPath: manifest,
    };

    await this.executeJob(job, args, "Split complete.", "Split failed (see Jobs).");
  }

  private async pageImagesInFolder() {
    if (!this.ensureCliConfigured()) return;
    if (this.pageImagesFlowRunning) {
      new Notice("Page-images flow is already running.");
      return;
    }
    this.pageImagesFlowRunning = true;

    try {
      let runOptions = null;
      try {
        runOptions = await PageImagesRunModal.open(this.app);
      } catch (err) {
        console.error("PDF Toolkit: failed to open page-images run modal", err);
        new Notice("Could not open page-images options.");
        return;
      }
      if (!runOptions) return;

      const runId = makeRunId();
      const outDir = this.runOutputDir(runId);
      const manifest = this.manifestPath(runId);
      const inDir = runOptions.inDir;
      const absInDir = this.toAbs(inDir);
      const absOutDir = this.toAbs(outDir);
      const absManifest = this.toAbs(manifest);

      try {
        await this.ensureFolderExists(outDir);
      } catch {
        new Notice("Could not create output folder in the vault.");
        return;
      }

      const args = [
        "page-images",
        "--in_dir", absInDir,
        "--out_dir", absOutDir,
        "--manifest", absManifest,
        "--glob", runOptions.glob,
        "--mode", runOptions.mode,
      ];
      if (runOptions.gutterTrimPx > 0) {
        args.push("--gutter_trim_px", String(runOptions.gutterTrimPx));
      }
      if (runOptions.edgeInsetPx > 0) {
        args.push("--edge_inset_px", String(runOptions.edgeInsetPx));
      }
      if (runOptions.overwrite) args.push("--overwrite");
      if (runOptions.debug) args.push("--debug");

      const job: JobRecord = {
        id: runId,
        startedAt: Date.now(),
        command: [this.settings.cliCommand, ...this.settings.cliArgsPrefix, ...args],
        inputPath: inDir,
        outputDir: outDir,
        manifestPath: manifest,
      };

      await this.executeJob(
        job,
        args,
        "Page image processing complete.",
        "Page image processing failed (see Jobs).",
      );
    } finally {
      this.pageImagesFlowRunning = false;
    }
  }

  private async rotateActivePdf() {
    if (!this.ensureCliConfigured()) return;
    const pdf = this.ensureActivePdf();
    if (!pdf) return;

    const options = await RotateOptionsModal.open(this.app);
    if (!options) return;

    const runId = makeRunId();
    const outDir = this.runOutputDir(runId);
    const manifest = this.manifestPath(runId);
    const outPdf = normalizePath(`${outDir}/${pdf.basename}.rotated.pdf`);
    const absPdf = this.toAbs(pdf.path);
    const absOutPdf = this.toAbs(outPdf);
    const absManifest = this.toAbs(manifest);

    try {
      await this.ensureFolderExists(outDir);
    } catch {
      new Notice("Could not create output folder in the vault.");
      return;
    }

    const args = [
      "rotate", "pdf",
      "--pdf", absPdf,
      "--out_pdf", absOutPdf,
      "--manifest", absManifest,
      "--degrees", String(options.degrees),
    ];
    if (options.pages) args.push("--pages", options.pages);

    const job: JobRecord = {
      id: runId,
      startedAt: Date.now(),
      command: [this.settings.cliCommand, ...this.settings.cliArgsPrefix, ...args],
      inputPath: pdf.path,
      outputDir: outDir,
      manifestPath: manifest,
    };

    await this.executeJob(job, args, "Rotate complete.", "Rotate failed (see Jobs).");
  }
}
