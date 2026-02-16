import { spawn } from "child_process";
import { App, normalizePath } from "obsidian";
import type { PdfToolkitSettings, Verbosity } from "./settings";

export interface RunCliResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function verbosityArgs(v: Verbosity): string[] {
  if (v === "quiet") return ["--quiet"];
  if (v === "verbose") return ["--verbose"];
  return [];
}

export function makeRunId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(16).slice(2, 8);
  return `${ts}_${rand}`;
}

export function vaultAbsPath(app: App): string {
  // Obsidian desktop exposes adapter base path.
  // @ts-ignore
  return app.vault.adapter.basePath as string;
}

export function toVaultRelative(path: string): string {
  return normalizePath(path.replace(/\\/g, "/"));
}

export async function runPdfToolkit(
  app: App,
  settings: PdfToolkitSettings,
  args: string[],
  verbosity: Verbosity
): Promise<RunCliResult> {
  const command = settings.cliCommand;
  const fullArgs = [
    ...settings.cliArgsPrefix,
    ...verbosityArgs(verbosity),
    ...args,
  ];

  const cwd = vaultAbsPath(app);

  return await new Promise((resolve) => {
    const child = spawn(command, fullArgs, { cwd, windowsHide: true });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}
