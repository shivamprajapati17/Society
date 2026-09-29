import Image from "next/image";

/**
 * The hero's media layer: the society photo when it exists, otherwise a warm
 * dusk gradient so the layout never shows a broken image. A left-to-right dark
 * overlay keeps the headline legible over either.
 */
export default function HeroBackdrop({
  image,
  alt,
  blurred = false,
}: {
  image: string | null;
  alt: string;
  /** The auth pages reuse the photo, softened so the glass card reads clearly. */
  blurred?: boolean;
}) {
  return (
    <div className={`hero-media${blurred ? " is-blurred" : ""}`}>
      {image ? (
        <Image
          src={image}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="hero-img"
        />
      ) : (
        <div className="hero-placeholder" />
      )}
      <div className="hero-overlay" />
    </div>
  );
}
