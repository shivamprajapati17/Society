"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { society } from "@/lib/society.config";

/**
 * Bottom-left media pill. Only rendered when a video exists on disk, so the
 * page never offers a control that cannot play anything. Muted and looped, so
 * it never surprises anyone with sound.
 */
export default function HeroMediaPill({ video }: { video: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const node = ref.current;
    if (!node) return;
    if (node.paused) {
      void node.play();
      setPlaying(true);
    } else {
      node.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="media-pill glass">
      <video
        ref={ref}
        className="media-pill-video"
        src={video}
        muted
        loop
        playsInline
        preload="metadata"
      />
      <span className="media-pill-text">
        <span className="media-pill-title">{society.hero.pillTitle}</span>
        <span className="media-pill-sub">{society.hero.pillSubtitle}</span>
      </span>
      <button
        type="button"
        className="media-pill-btn"
        onClick={toggle}
        aria-label={playing ? "Pause the ambient film" : "Play the ambient film"}
      >
        {playing ? (
          <Pause size={18} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Play size={18} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
