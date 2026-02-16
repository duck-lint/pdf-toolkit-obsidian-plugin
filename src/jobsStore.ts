type PluginData = Record<string, unknown>;

interface PluginDataStore {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

export interface JobRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  status?: "ok" | "error";
  exitCode?: number | null;
  command: string[];
  inputPath?: string;
  outputDir?: string;
  manifestPath?: string;
  stdoutTail?: string;
  stderrTail?: string;
  error?: string;
}

export class JobsStore {
  private plugin: PluginDataStore;

  constructor(plugin: PluginDataStore) {
    this.plugin = plugin;
  }

  async load(): Promise<JobRecord[]> {
    const data = await this.plugin.loadData();
    if (!data || typeof data !== "object") return [];
    const jobs = (data as PluginData).jobs;
    return Array.isArray(jobs) ? (jobs as JobRecord[]) : [];
  }

  async save(jobs: JobRecord[]): Promise<void> {
    const existing = await this.plugin.loadData();
    const data: PluginData =
      existing && typeof existing === "object" ? (existing as PluginData) : {};
    await this.plugin.saveData({ ...data, jobs });
  }

  async upsert(job: JobRecord): Promise<void> {
    const jobs = await this.load();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) jobs[idx] = job;
    else jobs.unshift(job);
    await this.save(jobs.slice(0, 200)); // keep it lean
  }
}
