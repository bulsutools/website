export const SITE_ORIGIN = "https://bulsu.tools";
export const SITE_NAME = "bulsu.tools";

export const DEFAULT_TITLE = "bulsu.tools";
export const DEFAULT_DESCRIPTION =
  "Geary, the BulSU GWA Calculator and Room TBA: free, open-source tools for Bulacan State University students, built by students on GitHub. Not an official BulSU site.";

export const DEFAULT_OG_IMAGE = "/og.png";
export const DEFAULT_OG_IMAGE_ALT =
  "bulsu.tools, with Geary, the GWA Calculator and Room TBA for BulSU students";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function absoluteUrl(path: string, origin = SITE_ORIGIN): string {
  return new URL(path, origin).href;
}
