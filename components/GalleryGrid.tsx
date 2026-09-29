"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Gallery grid with a lightbox. Client-side, and only mounted when the config
 * lists at least one image, so an empty society sees an honest empty state.
 */
export default function GalleryGrid({ images }: { images: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") {
        setOpenIndex((i) => (i === null ? i : (i + 1) % images.length));
      }
      if (event.key === "ArrowLeft") {
        setOpenIndex((i) =>
          i === null ? i : (i - 1 + images.length) % images.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close, images.length]);

  const current = openIndex === null ? null : images[openIndex];

  return (
    <>
      <div className="gallery-grid">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            className="gallery-item"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open photo ${index + 1} of ${images.length}`}
          >
            <Image
              src={src}
              alt=""
              width={640}
              height={420}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="gallery-img"
            />
          </button>
        ))}
      </div>

      {current ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={close}
            aria-label="Close photo viewer"
            autoFocus
          >
            <X size={22} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <Image
            src={current}
            alt=""
            width={1600}
            height={1000}
            sizes="90vw"
            className="lightbox-img"
          />
        </div>
      ) : null}
    </>
  );
}
