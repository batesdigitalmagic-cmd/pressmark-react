import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class StorageUnavailableError extends Error {}
const validId = (jobId) => {
  if (!/^[a-f0-9]{64}$/.test(jobId || "")) throw new Error("Invalid job ID.");
  return jobId;
};

export function getRenderJobStorage() {
  if (process.env.PRESSMARK_RENDER_STORAGE !== "local" && process.env.NODE_ENV !== "test") {
    throw new StorageUnavailableError("Directory rendering is not configured for production durable storage yet.");
  }
  const root = path.resolve(process.env.PRESSMARK_RENDER_LOCAL_DIR || ".pressmark-render-jobs");
  const directory = (id) => path.join(root, validId(id));
  const metadata = (id) => path.join(directory(id), "job.json");
  const atomicJson = async (file, value) => {
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, file);
  };
  return {
    async create(job, bytes) {
      await mkdir(directory(job.jobId), { recursive: false });
      await writeFile(path.join(directory(job.jobId), "input.csv"), bytes);
      await atomicJson(metadata(job.jobId), job);
      return job;
    },
    async get(id) {
      try { return JSON.parse(await readFile(metadata(id), "utf8")); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    },
    async update(id, patch) {
      const current = await this.get(id);
      if (!current) return null;
      const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await atomicJson(metadata(id), updated);
      return updated;
    },
    async claim() {
      await mkdir(root, { recursive: true });
      const ids = (await readdir(root)).filter((name) => /^[a-f0-9]{64}$/.test(name)).sort();
      for (const id of ids) {
        const job = await this.get(id);
        if (job?.status === "queued") return this.update(id, { status: "processing", errorMessage: "" });
      }
      return null;
    },
    input(id) { return readFile(path.join(directory(id), "input.csv")); },
    async putOutput(id, bytes) { await writeFile(path.join(directory(id), "output.pdf"), bytes); },
    async output(id) {
      try { return await readFile(path.join(directory(id), "output.pdf")); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    },
  };
}
