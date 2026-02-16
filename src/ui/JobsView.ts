import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type PdfToolkitPlugin from "../main";

export const JOBS_VIEW_TYPE = "pdf-toolkit-jobs";

export class JobsView extends ItemView {
  plugin: PdfToolkitPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: PdfToolkitPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return JOBS_VIEW_TYPE;
  }

  getDisplayText() {
    return "PDF Toolkit Jobs";
  }

  async onOpen() {
    await this.render();
  }

  async render() {
    const el = this.contentEl;
    el.empty();

    const jobs = await this.plugin.jobs.load();

    const header = el.createEl("div", { text: "Recent runs" });
    header.style.fontWeight = "600";
    header.style.marginBottom = "8px";

    for (const job of jobs) {
      const row = el.createEl("div");
      row.style.border = "1px solid var(--background-modifier-border)";
      row.style.borderRadius = "8px";
      row.style.padding = "8px";
      row.style.marginBottom = "8px";

      const title = row.createEl("div", { text: job.id });
      title.style.fontFamily = "var(--font-monospace)";
      title.style.fontSize = "12px";

      const exitCodeText = job.exitCode === undefined
        ? ""
        : ` (exit ${String(job.exitCode)})`;
      const status = row.createEl("div", { text: `${job.status ?? "running/unknown"}${exitCodeText}` });
      status.style.opacity = "0.85";

      if (job.error) {
        const err = row.createEl("div", { text: job.error });
        err.style.color = "var(--text-error)";
        err.style.whiteSpace = "pre-wrap";
        err.style.marginTop = "6px";
      }

      const cmd = row.createEl("div", { text: (job.command ?? []).join(" ") });
      cmd.style.opacity = "0.7";
      cmd.style.fontSize = "12px";
      cmd.style.whiteSpace = "pre-wrap";
      cmd.style.marginTop = "6px";

      if (job.stdoutTail !== undefined) {
        const stdoutDetails = row.createEl("details");
        stdoutDetails.style.marginTop = "6px";
        stdoutDetails.createEl("summary", { text: "stdout (tail)" });
        const stdoutPre = stdoutDetails.createEl("pre", {
          text: job.stdoutTail || "(empty)",
        });
        stdoutPre.style.whiteSpace = "pre-wrap";
        stdoutPre.style.marginTop = "6px";
        stdoutPre.style.fontSize = "12px";
      }

      if (job.stderrTail !== undefined) {
        const stderrDetails = row.createEl("details");
        stderrDetails.style.marginTop = "6px";
        stderrDetails.createEl("summary", { text: "stderr (tail)" });
        const stderrPre = stderrDetails.createEl("pre", {
          text: job.stderrTail || "(empty)",
        });
        stderrPre.style.whiteSpace = "pre-wrap";
        stderrPre.style.marginTop = "6px";
        stderrPre.style.fontSize = "12px";
      }

      const actions = row.createEl("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.marginTop = "8px";

      if (job.manifestPath) {
        const btn = actions.createEl("button", { text: "Open manifest" });
        btn.onclick = async () => {
          const file = this.plugin.app.vault.getAbstractFileByPath(job.manifestPath!);
          if (file instanceof TFile) {
            await this.plugin.app.workspace.getLeaf(true).openFile(file);
          }
        };
      }

      if (job.outputDir) {
        const btn2 = actions.createEl("button", { text: "Reveal output folder" });
        btn2.onclick = async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const electron = require("electron");
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require("path");
            const basePath = (this.plugin.app.vault.adapter as any).basePath;
            const abs = path.join(basePath, job.outputDir);
            await electron.shell.openPath(abs);
          } catch {
            // non-fatal
          }
        };
      }
    }

    if (jobs.length === 0) {
      const empty = el.createEl("div", { text: "No runs yet." });
      empty.style.opacity = "0.7";
    }
  }
}
