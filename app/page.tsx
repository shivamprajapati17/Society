import type { Metadata } from "next";

import Landing from "@/components/Landing";
import { getSessionProfile } from "@/lib/auth";
import { nvidiaModel } from "@/lib/env";
import { heroAssets } from "@/lib/hero";
import { listEvents, listNotices, residentCount } from "@/lib/notices";
import { society } from "@/lib/society.config";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `${society.name} — Residential Society`,
  description: `${society.subhead}. Notices, events and amenities for the residents of ${society.name}.`,
  openGraph: {
    title: `${society.name} — Residential Society`,
    description: society.subhead,
    images: [{ url: society.hero.image }],
  },
};

/** `moonshotai/kimi-k3` -> `kimi-k3`, so the label never drifts from config. */
function shortModelName(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

export default async function HomePage() {
  const [notices, events, residents, profile] = await Promise.all([
    listNotices(),
    listEvents(),
    residentCount(),
    getSessionProfile(),
  ]);

  const { image, video } = heroAssets();

  return (
    <Landing
      signedIn={Boolean(profile)}
      image={image}
      video={video ? society.hero.video : null}
      notices={notices}
      events={events}
      residents={residents}
      modelLabel={`NVIDIA NIM · ${shortModelName(nvidiaModel())}`}
    />
  );
}
