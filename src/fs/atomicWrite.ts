// The one durable-write primitive. Three commands in cli.ts each grew their own
// tmp-then-rename dance, and one of them (the baseline receipt) differed in a way that
// mattered: it must refuse to overwrite. That difference is now an option, not a
// reimplementation.

import { linkSync, renameSync, rmSync, writeFileSync } from "node:fs";

export interface AtomicWriteOptions {
  /**
   * Refuse to replace an existing file: the write fails with EEXIST and the file on disk is
   * untouched. Issuing a trust anchor over an already-issued one is not a write to retry, it
   * is a mistake to report, so the baseline-receipt path takes this.
   */
  exclusive?: boolean;
}

/**
 * Write `contents` to `path` so a reader sees either the old file or the whole new one, never
 * a half-written file: the bytes land in a sibling temporary first, then one atomic filesystem
 * operation publishes them. The temporary is removed whether the write succeeded or threw.
 *
 * Exclusive mode links instead of renaming, because rename replaces silently while link fails
 * on an existing target - and it fails before the temporary is published, so a refused write
 * cannot leave a partial file either.
 */
export function atomicWriteFileSync(path: string, contents: string, options: AtomicWriteOptions = {}): void {
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
    if (options.exclusive) linkSync(temporary, path);
    else renameSync(temporary, path);
  } finally {
    // A successful rename has already consumed the temporary; force covers that and the
    // case where the write itself never created one.
    rmSync(temporary, { force: true });
  }
}
