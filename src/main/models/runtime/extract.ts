/** Extract — sha512 + 7z archive extract. */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export async function sha512File(file: string): Promise<string> {
  const h = createHash("sha512");
  await new Promise<void>((resolve, reject) => {
    const rs = fs.createReadStream(file);
    rs.on("data", (c: Buffer) => h.update(c));
    rs.on("end", () => resolve());
    rs.on("error", reject);
  });
  return h.digest("hex");
}

function sevenZrPath(): string | null {
  const res = process.resourcesPath;
  const candidates = [
    path.join(res, "7zr.exe"),
    path.join(res, "resources", "7zr.exe"),
    path.join(res, "ort", "7zr.exe"),
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

function countFiles7z(archive: string, signal?: AbortSignal): Promise<number> {
  const exe = sevenZrPath();
  if (!exe)
    return Promise.reject(new Error("7zr.exe not found in app resources"));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Runtime installation cancelled"));
      return;
    }
    const p = spawn(exe, ["l", archive], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    p.stdout?.on("data", (d: Buffer) => {
      out += d.toString();
      if (out.length > 16384) out = out.slice(-16384);
    });
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 8192) err = err.slice(-8192);
    });
    p.on("error", reject);
    const abort = (): void => {
      p.kill();
      reject(new Error("Runtime installation cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    p.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) {
        reject(new Error("Runtime installation cancelled"));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `7zr list failed (exit ${code}): ${err.trim() || out.trim()}`,
          ),
        );
        return;
      }
      const m = out.match(/Files:\s+(\d+)/i);
      resolve(m ? parseInt(m[1], 10) : 0);
    });
  });
}

export function extract7z(
  archive: string,
  dest: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const exe = sevenZrPath();
  if (!exe)
    return Promise.reject(new Error("7zr.exe not found in app resources"));
  fs.mkdirSync(dest, { recursive: true });
  return countFiles7z(archive, signal).then(
    (totalFiles) =>
      new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Runtime installation cancelled"));
          return;
        }
        const p = spawn(exe, ["x", archive, `-o${dest}`, "-y", "-bsp1"], {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let extracted = 0;
        let lastPct = -1;
        let err = "";
        let stdoutTail = "";
        let hasStreamProgress = false;
        p.stdout?.on("data", (d: Buffer) => {
          const chunk = d.toString();
          const output = stdoutTail + chunk;
          stdoutTail = output.slice(-32);
          const matches = chunk.match(/Extracting/g);
          if (matches) {
            extracted += matches.length;
            if (totalFiles > 0 && !hasStreamProgress) {
              report(Math.round((extracted / totalFiles) * 100));
            }
          }
          const progressLines = output.match(/\b\d{1,3}%/g) || [];
          if (progressLines.length) hasStreamProgress = true;
          progressLines.forEach((value) => report(parseInt(value, 10)));
        });
        p.stderr?.on("data", (d: Buffer) => {
          err += d.toString();
          if (err.length > 8192) err = err.slice(-8192);
        });
        p.on("error", reject);
        const abort = (): void => {
          p.kill();
        };
        signal?.addEventListener("abort", abort, { once: true });
        p.on("close", (code) => {
          signal?.removeEventListener("abort", abort);
          if (signal?.aborted) {
            reject(new Error("Runtime installation cancelled"));
            return;
          }
          if (code === 0) {
            onProgress?.(100);
            resolve();
          } else {
            reject(
              new Error(
                `7zr extract failed (exit ${code}): ${err.trim() || "no error output"}`,
              ),
            );
          }
        });

        function report(value: number): void {
          const pct = Math.max(0, Math.min(100, value));
          if (pct <= lastPct) return;
          lastPct = pct;
          onProgress?.(pct);
        }
        if (signal?.aborted) abort();
      }),
  );
}
