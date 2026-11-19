export const SIZES = [
  { label: "1280", width: 1280, height: 800 },
  { label: "1920", width: 1920, height: 1080 },
];

/** powershell.exe arguments that open `url` in a new Chrome window of `size`, leaving other windows alone. */
export function sizedOpen(script, url, size) {
  return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Url", url, "-Width", String(size.width), "-Height", String(size.height)];
}
