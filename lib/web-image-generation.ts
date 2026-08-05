import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const resolveAppRoot = (): string => {
  const envRoot = process.env.APP_ROOT?.trim();
  if (envRoot) {
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(envRoot);
  }
  return process.cwd();
};

type GenerateWebImageOptions = {
  maxEdge?: number;
  quality?: number;
  timeoutMs?: number;
};

const formatExecError = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "Unknown Python image generation error.";
  }

  const record = error as {
    message?: string;
    code?: string | number;
    signal?: string;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };

  const parts: string[] = [];
  if (record.message) parts.push(record.message);
  if (record.code !== undefined) parts.push(`code=${String(record.code)}`);
  if (record.signal) parts.push(`signal=${record.signal}`);

  const stderr = typeof record.stderr === "string" ? record.stderr : record.stderr?.toString("utf8");
  const stdout = typeof record.stdout === "string" ? record.stdout : record.stdout?.toString("utf8");
  const detail = (stderr || stdout || "").trim();
  if (detail) {
    parts.push(detail.slice(0, 1500));
  }

  return parts.filter(Boolean).join(" | ") || "Unknown Python image generation error.";
};

export const generateWebImageFromMaster = async (
  inputPath: string,
  outputPath: string,
  options: GenerateWebImageOptions = {},
): Promise<void> => {
  const appRoot = resolveAppRoot();
  const venvPython = path.join(appRoot, ".worker-venv", "bin", "python3");
  const scriptPath = path.join(appRoot, "worker", "generate_web_image.py");

  if (!fs.existsSync(venvPython)) {
    throw new Error(
      `Worker Python is missing at ${venvPython}. Run deploy/scripts so .worker-venv is installed.`,
    );
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Web image script is missing at ${scriptPath}.`);
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Master TIFF was not found: ${inputPath}`);
  }

  const args = [scriptPath, inputPath, outputPath];
  if (typeof options.maxEdge === "number") {
    args.push("--max-edge", String(options.maxEdge));
  }
  if (typeof options.quality === "number") {
    args.push("--quality", String(options.quality));
  }

  try {
    await execFileAsync(venvPython, args, {
      cwd: appRoot,
      timeout: options.timeoutMs ?? 120_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Failed to generate web image from master TIFF. ${formatExecError(error)}`);
  }
};
