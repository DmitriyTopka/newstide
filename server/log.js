// Run Log: every analysis is saved with its hidden chain, so it can be read later.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function saveRun(root, run) {
  const dir = path.join(root, 'runs');
  await mkdir(dir, { recursive: true });
  const name = `${run.at.replace(/[:.]/g, '-')}-${run.input.coin}.json`;
  await writeFile(path.join(dir, name), JSON.stringify(run, null, 2));
  return `runs/${name}`;
}
