import { App, PluginSettingTab, Setting } from "obsidian";
import type PdfToolkitPlugin from "./main";

export type Verbosity = "quiet" | "normal" | "verbose";

export interface PdfToolkitSettings {
  // Explicit per-vault command path is preferred (no PATH assumptions).
  // Example (Windows): C:\\path\\to\\venv\\Scripts\\pdf-toolkit.exe
  // Example (module):  C:\\path\\to\\venv\\Scripts\\python.exe   with cliArgsPrefix: ["-m","pdf-toolkit"]
  cliCommand: string;
  cliArgsPrefix: string[];         // e.g. [] or ["-m", "pdf-toolkit"]
  outputRoot: string;              // vault-relative folder
  defaultVerbosity: Verbosity;
  revealAfterSuccess: boolean;
}

export const DEFAULT_SETTINGS: PdfToolkitSettings = {
  // Require explicit per-vault configuration.
  cliCommand: "",
  cliArgsPrefix: [],
  outputRoot: "pdf-toolkit_Output",
  defaultVerbosity: "quiet",
  revealAfterSuccess: true,
};

export class PdfToolkitSettingTab extends PluginSettingTab {
  plugin: PdfToolkitPlugin;

  constructor(app: App, plugin: PdfToolkitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("CLI command")
      .setDesc('Full path is recommended (per-vault). Example: "C:\\\\...\\\\pdf-toolkit.exe" or "...\\\\python.exe".')
      .addText(t =>
        t.setValue(this.plugin.settings.cliCommand)
         .onChange(async v => {
           this.plugin.settings.cliCommand = v.trim();
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("CLI args prefix")
      .setDesc('Optional prefix args (e.g. to use python module: "-m pdf-toolkit"). Space-separated.')
      .addText(t =>
        t.setValue(this.plugin.settings.cliArgsPrefix.join(" "))
         .onChange(async v => {
           this.plugin.settings.cliArgsPrefix = v.split(" ").map(s => s.trim()).filter(Boolean);
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Output root folder (vault-relative)")
      .setDesc('Where runs are written inside the vault. Outputs always remain in-vault.')
      .addText(t =>
        t.setValue(this.plugin.settings.outputRoot)
         .onChange(async v => {
           this.plugin.settings.outputRoot = v.trim().replace(/\\/g, "/");
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Default verbosity")
      .setDesc("Controls console logging from the CLI.")
      .addDropdown(d =>
        d.addOptions({ quiet: "quiet", normal: "normal", verbose: "verbose" })
         .setValue(this.plugin.settings.defaultVerbosity)
         .onChange(async (v: any) => {
           this.plugin.settings.defaultVerbosity = v;
           await this.plugin.saveSettings();
         })
      );

    new Setting(containerEl)
      .setName("Reveal output folder after success")
      .addToggle(t =>
        t.setValue(this.plugin.settings.revealAfterSuccess)
         .onChange(async v => {
           this.plugin.settings.revealAfterSuccess = v;
           await this.plugin.saveSettings();
         })
      );
  }
}
