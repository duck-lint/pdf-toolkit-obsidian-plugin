import { App, Modal, Notice, Setting } from "obsidian";

export interface RenderOptions {
  dpi: number;
  pages?: string;
  overwrite: boolean;
}

type RenderResolve = (value: RenderOptions | null) => void;

export class RenderOptionsModal extends Modal {
  private readonly resolve: RenderResolve;
  private settled = false;

  private dpiValue = "300";
  private pagesValue = "";
  private overwrite = false;

  constructor(app: App, resolve: RenderResolve) {
    super(app);
    this.resolve = resolve;
  }

  static async open(app: App): Promise<RenderOptions | null> {
    return await new Promise((resolve) => {
      const modal = new RenderOptionsModal(app, resolve);
      modal.open();
    });
  }

  onOpen(): void {
    this.titleEl.setText("Render active PDF");

    new Setting(this.contentEl)
      .setName("DPI")
      .setDesc("72 to 600")
      .addText((text) =>
        text
          .setValue(this.dpiValue)
          .onChange((value) => {
            this.dpiValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Pages (optional)")
      .setDesc('Examples: "1-5,8,10-"')
      .addText((text) =>
        text
          .setPlaceholder("all")
          .setValue(this.pagesValue)
          .onChange((value) => {
            this.pagesValue = value.trim();
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
      const dpi = Number.parseInt(this.dpiValue, 10);
      if (!Number.isInteger(dpi) || dpi < 72 || dpi > 600) {
        new Notice("DPI must be an integer from 72 to 600.");
        return;
      }

      this.settle({
        dpi,
        pages: this.pagesValue || undefined,
        overwrite: this.overwrite,
      });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(null);
  }

  private settle(value: RenderOptions | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
  }
}
