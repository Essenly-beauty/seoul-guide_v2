import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectDaisoSeoul, parseDaisoSnapshot, type DaisoFetch } from "../lib/daiso-import";

export const DAISO_CANDIDATE_PATH = resolve("data/candidates/daiso-seoul-candidate.json");
const EXPECTED_DAISO_STORE_COUNT = 251;

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function runDaisoCollector(options: {
  fetchImpl?: DaisoFetch;
  outputPath?: string;
  retrievedAt?: string;
  timeoutMs?: number;
} = {}): Promise<void> {
  const snapshot = await collectDaisoSeoul({
    fetchImpl: options.fetchImpl ?? fetch,
    retrievedAt: options.retrievedAt,
    timeoutMs: options.timeoutMs,
  });
  const result = parseDaisoSnapshot(snapshot, { mode: "officialProvisional" });
  if (result.published.length !== EXPECTED_DAISO_STORE_COUNT) {
    throw new Error(
      `Expected exactly ${EXPECTED_DAISO_STORE_COUNT} collected Daiso stores, received ${result.published.length}`,
    );
  }
  await writeJsonAtomically(options.outputPath ?? DAISO_CANDIDATE_PATH, snapshot);
}

const modulePath = fileURLToPath(import.meta.url);
const isMain = process.argv.slice(1).some((argument) => resolve(argument) === modulePath);
if (isMain) {
  runDaisoCollector()
    .then(() => console.log(`Wrote candidate ${DAISO_CANDIDATE_PATH}; review and approve it before explicitly staging the immutable build source.`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
