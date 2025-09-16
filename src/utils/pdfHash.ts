import fs from "fs";
import path from "path";
import crypto from "crypto";

function resolveAbsolutePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(process.cwd(), filePath);
}

export function computePdfHash(filePath: string): string {
  const absolutePath = resolveAbsolutePath(filePath);
  const buffer = fs.readFileSync(absolutePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
