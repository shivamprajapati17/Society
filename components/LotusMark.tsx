/**
 * The site's lotus mark, drawn inline so it inherits `currentColor`
 * (09-WEBSITE-TEMPLATE-PROMPT.md §3). No image request, no extra dependency.
 */
export function LotusMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* centre petal */}
      <path d="M24 6c4.1 4.6 6.2 9.3 6.2 14 0 4.7-2.1 8.5-6.2 11.3-4.1-2.8-6.2-6.6-6.2-11.3C17.8 15.3 19.9 10.6 24 6Z" />
      {/* inner side petals */}
      <path d="M11.4 15.6c5.6 1.7 9.7 4.5 12.2 8.6 2.5 4.1 3.3 8.3 2.4 12.4-4.6-.8-8.3-3.3-11.2-7.6-2.9-4.3-4-8.7-3.4-13.4Z" />
      <path d="M36.6 15.6c.6 4.7-.5 9.1-3.4 13.4-2.9 4.3-6.6 6.8-11.2 7.6-.9-4.1-.1-8.3 2.4-12.4 2.5-4.1 6.6-6.9 12.2-8.6Z" />
      {/* outer petals */}
      <path d="M4.6 28.4c4.4.4 8.1 2 11.2 4.8 3.1 2.8 5.1 6 6 9.6-4.6.2-8.8-1-12.5-3.6-3.7-2.6-5.3-6.2-4.7-10.8Z" />
      <path d="M43.4 28.4c.6 4.6-1 8.2-4.7 10.8-3.7 2.6-7.9 3.8-12.5 3.6.9-3.6 2.9-6.8 6-9.6 3.1-2.8 6.8-4.4 11.2-4.8Z" />
      {/* water line */}
      <path d="M9 43.5c3.8 0 6.3-.9 7.5-.9s3.8.9 7.5.9 6.3-.9 7.5-.9 3.7.9 7.5.9" />
    </svg>
  );
}

/** Thin gold rule with the mark in the middle — the hero's opening ornament. */
export function LotusOrnament({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span className="ornament-rule" />
      <LotusMark size={26} />
      <span className="ornament-rule" />
    </span>
  );
}

export default LotusMark;
