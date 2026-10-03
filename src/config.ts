import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Config, object } from "./model.js";
import { compileCustom } from "./privacy.js";
import { safePath } from "./store.js";
export const DEFAULT_CONFIG: Config = {
  captureContent: false,
  customRedactions: [],
  windowMs: 120000,
  repeatedCalls: 3,
  failureLoop: 3,
  excessiveRetries: 6,
  longToolMs: 120000,
  oscillations: 4,
  completionMarker: null,
};
export function parseConfig(value: unknown): Config {
  const raw = object(value);
  const known = Object.keys(DEFAULT_CONFIG);
  if (Object.keys(raw).some((k) => !known.includes(k)))
    throw new Error("Unknown configuration key");
  const config = { ...DEFAULT_CONFIG, ...raw } as Config;
  if (typeof config.captureContent !== "boolean")
    throw new Error("captureContent must be boolean");
  for (const name of [
    "windowMs",
    "repeatedCalls",
    "failureLoop",
    "excessiveRetries",
    "longToolMs",
    "oscillations",
  ] as const) {
    if (
      !Number.isSafeInteger(config[name]) ||
      config[name] < 1 ||
      config[name] > 86400000
    )
      throw new Error("Invalid detector threshold");
  }
  if (
    !Array.isArray(config.customRedactions) ||
    config.customRedactions.length > 20 ||
    config.customRedactions.some((p) => typeof p !== "string")
  )
    throw new Error("Invalid customRedactions");
  config.customRedactions.forEach(compileCustom);
  if (
    config.completionMarker !== null &&
    (typeof config.completionMarker !== "string" ||
      !/^[A-Z_]{8,80}$/.test(config.completionMarker))
  )
    throw new Error("Invalid completionMarker");
  return config;
}
export function loadConfig(root: string): Config {
  const path = join(root, "config.json");
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  safePath(path);
  return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
