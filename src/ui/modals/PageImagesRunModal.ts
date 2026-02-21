import { App, Modal, Notice, Setting, TFolder } from "obsidian";

export type PageImagesMode = "auto" | "split" | "crop";
export type PageImagesSymmetryStrategy =
  | "independent"
  | "match_max_width"
  | "mirror_from_gutter";

export interface PageImagesRunOptions {
  inDir: string;
  mode: PageImagesMode;
  glob: string;
  gutterTrimPx: number;
  edgeInsetPx: number;
  outerMarginFrac: number;
  symmetryStrategy: PageImagesSymmetryStrategy;
  overwrite: boolean;
  debug: boolean;
}

type PageImagesRunResolve = (value: PageImagesRunOptions | null) => void;

export class PageImagesRunModal extends Modal {
  private readonly resolve: PageImagesRunResolve;
  private readonly folders: TFolder[];
  private settled = false;

  private inDir = "";
  private mode: PageImagesMode = "auto";
  private globValue = "*.png";
  private gutterTrimPxValue = "0";
  private edgeInsetPxValue = "0";
  private outerMarginPercentValue = "";
  private symmetryStrategy: PageImagesSymmetryStrategy = "independent";
  private overwrite = false;
  private debug = false;

  constructor(app: App, folders: TFolder[], resolve: PageImagesRunResolve) {
    super(app);
    this.resolve = resolve;
    this.folders = folders;
    this.inDir = folders[0]?.path ?? "";
  }

  static async open(app: App): Promise<PageImagesRunOptions | null> {
    const folders = getVaultFolders(app)
      .filter((folder) => !isHiddenOrSystemFolder(folder))
      .sort((a, b) => a.path.localeCompare(b.path));

    return await new Promise((resolve) => {
      const modal = new PageImagesRunModal(app, folders, resolve);
      modal.open();
    });
  }

  onOpen(): void {
    this.titleEl.setText("Split spreads + crop images in folder");

    if (this.folders.length === 0) {
      this.contentEl.createEl("p", {
        text: "No folders are available in this vault.",
      });
      const closeBtn = this.contentEl.createEl("button", { text: "Close" });
      closeBtn.addEventListener("click", () => this.close());
      return;
    }

    new Setting(this.contentEl)
      .setName("Input folder")
      .setDesc("Vault folder containing page images.")
      .addDropdown((dropdown) => {
        for (const folder of this.folders) {
          dropdown.addOption(folder.path, folder.path);
        }
        dropdown
          .setValue(this.inDir)
          .onChange((value) => {
            this.inDir = value;
          });
      });

    new Setting(this.contentEl)
      .setName("Mode")
      .setDesc("auto=split wides, split=always split, crop=never split")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", "auto")
          .addOption("split", "split")
          .addOption("crop", "crop")
          .setValue(this.mode)
          .onChange((value: PageImagesMode) => {
            this.mode = value;
          }),
      );

    new Setting(this.contentEl)
      .setName("Glob pattern")
      .setDesc('Input file pattern (default: "*.png").')
      .addText((text) =>
        text
          .setValue(this.globValue)
          .onChange((value) => {
            this.globValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Gutter trim (px)")
      .setDesc("Shave pixels on both sides of the gutter after split.")
      .addText((text) =>
        text
          .setValue(this.gutterTrimPxValue)
          .onChange((value) => {
            this.gutterTrimPxValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Edge inset (px)")
      .setDesc("Inset final crop box inward to remove faint borders.")
      .addText((text) =>
        text
          .setValue(this.edgeInsetPxValue)
          .onChange((value) => {
            this.edgeInsetPxValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Outer margin clamp (%)")
      .setDesc("Clamp away from outer edge. Allowed: 0 to 25%.")
      .addText((text) =>
        text
          .setValue(this.outerMarginPercentValue)
          .onChange((value) => {
            this.outerMarginPercentValue = value.trim();
          }),
      );

    new Setting(this.contentEl)
      .setName("Symmetry strategy")
      .setDesc("Apply after left/right crop boxes are computed.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("independent", "Independent")
          .addOption("match_max_width", "Match max width")
          .addOption("mirror_from_gutter", "Mirror from gutter")
          .setValue(this.symmetryStrategy)
          .onChange((value: PageImagesSymmetryStrategy) => {
            this.symmetryStrategy = value;
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

    new Setting(this.contentEl)
      .setName("Debug overlay")
      .setDesc("Write decision overlays to _debug inside the run output folder.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.debug)
          .onChange((value) => {
            this.debug = value;
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
      if (!this.inDir) {
        new Notice("Input folder is required.");
        return;
      }
      if (!this.globValue) {
        new Notice("Glob pattern cannot be empty.");
        return;
      }

      const gutterTrimPx = this.gutterTrimPxValue
        ? Number.parseInt(this.gutterTrimPxValue, 10)
        : 0;
      if (!Number.isInteger(gutterTrimPx) || gutterTrimPx < 0) {
        new Notice("Gutter trim (px) must be an integer >= 0.");
        return;
      }

      const edgeInsetPx = this.edgeInsetPxValue
        ? Number.parseInt(this.edgeInsetPxValue, 10)
        : 0;
      if (!Number.isInteger(edgeInsetPx) || edgeInsetPx < 0) {
        new Notice("Edge inset (px) must be an integer >= 0.");
        return;
      }

      const outerMarginPercent = this.outerMarginPercentValue
        ? Number.parseFloat(this.outerMarginPercentValue)
        : 0;
      if (
        !Number.isFinite(outerMarginPercent)
        || outerMarginPercent < 0
        || outerMarginPercent > 25
      ) {
        new Notice("Outer margin clamp (%) must be a number from 0 to 25.");
        return;
      }
      const outerMarginFrac = outerMarginPercent / 100;

      this.settle({
        inDir: this.inDir,
        mode: this.mode,
        glob: this.globValue,
        gutterTrimPx,
        edgeInsetPx,
        outerMarginFrac,
        symmetryStrategy: this.symmetryStrategy,
        overwrite: this.overwrite,
        debug: this.debug,
      });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(null);
  }

  private settle(value: PageImagesRunOptions | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(value);
  }
}

function isHiddenOrSystemFolder(folder: TFolder): boolean {
  return folder.path.split("/").some((segment) => segment.startsWith("."));
}

function getVaultFolders(app: App): TFolder[] {
  const maybeGetAllFolders = (app.vault as unknown as {
    getAllFolders?: (includeRoot?: boolean) => TFolder[];
  }).getAllFolders;
  if (typeof maybeGetAllFolders === "function") {
    return maybeGetAllFolders.call(app.vault, false);
  }

  return app.vault
    .getAllLoadedFiles()
    .filter((item): item is TFolder => item instanceof TFolder && !item.isRoot());
}
