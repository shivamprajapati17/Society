/**
 * The single source of truth for every word and image on the public site.
 * Nothing on the landing page is hard-coded in JSX
 * (09-WEBSITE-TEMPLATE-PROMPT.md §4).
 *
 * Values left as `null`/empty are simply not rendered. Nothing here invents a
 * statistic or a claim: fill in the real figures for your society and the
 * corresponding section appears.
 */

export type IconName =
  | "leaf"
  | "shield-check"
  | "landmark"
  | "users"
  | "baby"
  | "bell"
  | "calendar"
  | "phone"
  | "home";

export interface Amenity {
  icon: IconName;
  label: string;
}

export interface CommitteeMember {
  name: string;
  role: string;
  flat: string;
}

export const society = {
  /** Shown in the navbar under the name. */
  name: "Suryanagari",
  nameCaps: "SURYANAGARI",
  tagline: "Residential Society",

  /** Hero headline, one line per entry. `accent` lines get the saffron gradient. */
  headline: [
    { text: "हमारा", accent: false },
    { text: "समाज", accent: true },
  ],
  subhead: "A Community Rooted in Tradition",
  motto: "Modern Living • Indian Values • Stronger Together",

  hero: {
    image: "/media/hero.jpg",
    video: "/media/hero.mp4",
    /* Shown instead of a photo until public/media/hero.jpg is added. */
    imageAlt:
      "Dusk view of the society courtyard with the temple arch and lit diyas",
    pillTitle: "A Peaceful Place to Call Home",
    pillSubtitle: "Where Traditions Live On",
  },

  /**
   * Set these to your society's real figures. While null the About section
   * simply omits them rather than guessing.
   */
  established: null as number | null,
  units: null as number | null,

  about: {
    title: "About the society",
    paragraphs: [
      "Suryanagari is a resident-run housing society where every family holds an equal voice. The committee is elected from the residents, and the accounts are shared openly at the annual general meeting.",
      "This website is the society's own notice board — announcements, events and maintenance complaints live here instead of getting lost in a group chat.",
    ],
  },

  amenities: [
    { icon: "leaf", label: "Beautiful Landscapes" },
    { icon: "shield-check", label: "24/7 Security" },
    { icon: "landmark", label: "Temple & Prayer Area" },
    { icon: "users", label: "Club House & Events" },
    { icon: "baby", label: "Children's Play Area" },
  ] as Amenity[],

  /**
   * A real telephone number for the security desk. While empty the Emergency
   * card is hidden — the site never prints a number it cannot stand behind.
   */
  emergencyPhone: "" as string,

  contact: {
    address: "" as string,
    email: "" as string,
    mapUrl: "" as string,
  },

  /** Committee members are listed by name only, and only once filled in. */
  committee: [] as CommitteeMember[],

  /**
   * Drop files into public/media/gallery/ and list them here, e.g.
   * "/media/gallery/onam-2024.jpg". The section renders an empty state while
   * the list is empty.
   */
  gallery: [] as string[],

  nav: [
    { label: "Home", href: "/" },
    { label: "About", href: "#about" },
    { label: "Amenities", href: "#amenities" },
    { label: "Events", href: "#events" },
    { label: "Notices", href: "#notices" },
    { label: "Gallery", href: "#gallery" },
    { label: "Contact", href: "#contact" },
  ],
} as const;

export type SocietyConfig = typeof society;
