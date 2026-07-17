import { execFile } from "node:child_process";
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

export const generateWebImageFromMaster = async (
  inputPath: string,
  outputPath: string,
  options: GenerateWebImageOptions = {},
): Promise<void> => {
  const appRoot = resolveAppRoot();
  const venvPython = path.join(appRoot, ".worker-venv", "bin", "python3");
  const scriptPath = path.join(appRoot, "worker", "generate_web_image.py");
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
    const message = error instanceof Error ? error.message : "Unknown Python image generation error.";
    throw new Error(`Failed to generate web image from master TIFF. ${message}`);
  }
};
