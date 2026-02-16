import { App, Modal, Notice, Setting } from "obsidian";

export type SplitStrategy = "ranges" | "pages_per_file";

export interface SplitOptions {
  strategy: SplitStrategy;
  ranges?: string;
  pagesPerFile?: number;
  overwrite: boolean;
}

type SplitResolve = (value: SplitOptions | null) => void;

export class SplitOptionsModal extends Modal {
  private readonly resolve: SplitResolve;
  private settled = false;

  private strategy: SplitStrategy = "ranges";
  private rangesValue = "";
  private pagesPerFileValue = "120";
  private overwrite = false;

  constructor(app: App, resolve: SplitResolve) {
    super(app);
    this.resolve = resolve;
  }

  static async open(app: App): Promise<SplitOptions | null> {
    return await new Promise((resolve) => {
      const modal = new SplitOptionsModal(app, resolve);
      modal.open();
    });
  }

  onOpen(): void {
    this.titleEl.setText("Split active PDF");

    new Setting(this.contentEl)
      .setName("Split strategy")
      .setDesc("The current CLI supports ranges or pages-per-file.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ranges", "Ranges")
          .addOption("pages_per_file", "Pages per file")
          .setValue(this.strategy)
          .onChange((value: SplitStrategy) => {
            this.strategy = value;
          }),
      );

    new Setting(this.contentEl)
      .setName("Ranges")
      .setDesc('Used when strategy is "Ranges". Example: "1-120,121-240".')
      .addText((text) =>
        text
          .setValue(this.rangesValue)
          .onChange((value) => {
            this.rangesValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Pages per file")
      .setDesc('Used when strategy is "Pages per file". Must be >= 1.')
      .addText((text) =>
        text
          .setValue(this.pagesPerFileValue)
          .onChange((value) => {
            this.pagesPerFileValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Overwrite existing files")
      .addToggle((toggle) =>
        toggle
          .setValue(this.overwrite)
          .onChange((value) => {
            this.overwrite = value;
          }),
      );

    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.settle(null);
      this.close();
    });

    const runBtn = buttons.createEl("button", { cls: "mod-cta", text: "Run" });
    runBtn.addEventListener("click", () => {
      if (this.strategy === "ranges") {
        if (!this.rangesValue) {
          new Notice("Ranges is required when split strategy is Ranges.");
          return;
        }

        this.settle({
          strategy: "ranges",
          ranges: this.rangesValue,
          overwrite: this.overwrite,
        });
        this.close();
        return;
      }

      const pagesPerFile = Number.parseInt(this.pagesPerFileValue, 10);
      if (!Number.isInteger(pagesPerFile) || pagesPerFile < 1 || pagesPerFile > 10000) {
        new Notice("Pages per file must be an integer from 1 to 10000.");
        return;
      }

      this.settle({
        strategy: "pages_per_file",
        pagesPerFile,
        overwrite: this.overwrite,
      });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(null);
  }

  private settle(value: SplitOptions | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
  }
}
