import { zipSync, strToU8 } from "fflate";

export function downloadZip(name: string, files: Record<string, string>) {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content);
  const blob = new Blob([zipSync(entries, { level: 6 }) as unknown as BlobPart], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
