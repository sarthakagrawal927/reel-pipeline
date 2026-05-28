import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class FileJobStore {
  constructor(options = {}) {
    this.dir = path.resolve(options.dir ?? process.env.REEL_PIPELINE_JOB_DIR ?? '.reel-pipeline/jobs');
  }

  async save(job) {
    await mkdir(this.dir, { recursive: true });
    const now = new Date().toISOString();
    const next = {
      ...job,
      updatedAt: now,
      createdAt: job.createdAt ?? now,
    };
    await writeFile(this.pathFor(job.id), JSON.stringify(next, null, 2));
    return next;
  }

  async get(id) {
    try {
      return JSON.parse(await readFile(this.pathFor(id), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  pathFor(id) {
    return path.join(this.dir, `${safeId(id)}.json`);
  }
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_.-]/g, '_');
}
