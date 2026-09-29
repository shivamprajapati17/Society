import { existsSync } from "node:fs";
import { join } from "node:path";

import { society } from "@/lib/society.config";

/**
 * Server-only. Reports which hero assets are actually on disk so the page can
 * fall back to a gradient (photo) or hide the media pill (video) instead of
 * shipping a broken request. Never import this from a client component.
 */
export function heroAssets(): { image: string | null; video: boolean } {
  const publicDir = join(process.cwd(), "public");
  const image = society.hero.image;

  const hasImage = existsSync(join(publicDir, image.replace(/^\//, "")));
  const hasVideo = existsSync(
    join(publicDir, society.hero.video.replace(/^\//, "")),
  );

  return { image: hasImage ? image : null, video: hasVideo };
}
