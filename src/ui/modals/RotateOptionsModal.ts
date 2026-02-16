import { App, Modal, Setting } from "obsidian";

export type RotateDegrees = 90 | 180 | 270;

export interface RotateOptions {
  degrees: RotateDegrees;
  pages?: string;
}

type RotateResolve = (value: RotateOptions | null) => void;

export class RotateOptionsModal extends Modal {
  private readonly resolve: RotateResolve;
  private settled = false;

  private degrees: RotateDegrees = 90;
  private pagesValue = "";

  constructor(app: App, resolve: RotateResolve) {
    super(app);
    this.resolve = resolve;
  }

  static async open(app: App): Promise<RotateOptions | null> {
    return await new Promise((resolve) => {
      const modal = new RotateOptionsModal(app, resolve);
      modal.open();
    });
  }

  onOpen(): void {
    this.titleEl.setText("Rotate active PDF pages");

    new Setting(this.contentEl)
      .setName("Degrees")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("90", "90")
          .addOption("180", "180")
          .addOption("270", "270")
          .setValue(String(this.degrees))
          .onChange((value: string) => {
            this.degrees = Number.parseInt(value, 10) as RotateDegrees;
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

    const outputNote = this.contentEl.createEl("div", {
      text: "Output is always written to a run-local PDF file.",
    });
    outputNote.style.opacity = "0.8";
    outputNote.style.marginTop = "4px";
    outputNote.style.marginBottom = "12px";

    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.settle(null);
      this.close();
    });

    const runBtn = buttons.createEl("button", { cls: "mod-cta", text: "Run" });
    runBtn.addEventListener("click", () => {
      this.settle({
        degrees: this.degrees,
        pages: this.pagesValue || undefined,
      });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(null);
  }

  private settle(value: RotateOptions | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
  }
}
