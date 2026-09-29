import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Mail,
  MapPin,
  Megaphone,
  Phone,
} from "lucide-react";

import GalleryGrid from "@/components/GalleryGrid";
import HeroBackdrop from "@/components/HeroBackdrop";
import HeroMediaPill from "@/components/HeroMediaPill";
import LotusMark, { LotusOrnament } from "@/components/LotusMark";
import SiteIcon from "@/components/SiteIcon";
import SiteNav from "@/components/SiteNav";
import { formatDateTime, hasDevanagari } from "@/lib/format";
import {
  latestNotice,
  nextEvent,
  type EventItem,
  type Notice,
} from "@/lib/notices";
import { society } from "@/lib/society.config";

interface Props {
  signedIn: boolean;
  image: string | null;
  video: string | null;
  notices: Notice[];
  events: EventItem[];
  residents: number;
  modelLabel: string;
}

export default function Landing({
  signedIn,
  image,
  video,
  notices,
  events,
  residents,
  modelLabel,
}: Props) {
  const notice = latestNotice(notices);
  const event = nextEvent(events);
  const { contact } = society;

  return (
    <div className="site">
      <SiteNav signedIn={signedIn} />

      {/* ---------------------------------------------------------------- hero */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <HeroBackdrop image={image} alt={society.hero.imageAlt} />

        {residents > 0 ? (
          <p className="hero-chip glass">
            {residents} flat{residents === 1 ? "" : "s"} on SocietyDesk
          </p>
        ) : null}

        <div className="hero-grid">
          <div className="hero-copy">
            <LotusOrnament className="hero-ornament" />

            <h1 className="hero-title" id="hero-heading">
              {society.headline.map((line) => (
                <span
                  key={line.text}
                  className={`hero-line${line.accent ? " accent" : ""}`}
                  lang={hasDevanagari(line.text) ? "hi" : undefined}
                >
                  {line.text}
                </span>
              ))}
            </h1>

            <p className="hero-subhead">{society.subhead}</p>
            <p className="hero-motto">{society.motto}</p>

            <div className="hero-cta">
              <a className="btn-maroon hero-cta-btn" href="#about">
                Explore Our Society
                <span className="hero-cta-arrow" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={1.8} />
                </span>
              </a>
            </div>

            <Link className="hero-report" href="/app/new">
              Report an issue
              <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>

          {/* --------------------------------------------------- hero glass cards */}
          <div className="hero-cards">
            <Link className="hero-card glass anim-card" href="/#notices">
              <span className="hero-card-icon">
                <Megaphone size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="hero-card-body">
                <span className="hero-card-title">
                  Latest Notice
                  {notice ? <em className="hero-card-badge">New</em> : null}
                </span>
                <span className="hero-card-sub">
                  {notice ? notice.title : "No notices yet"}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
            </Link>

            <Link className="hero-card glass anim-card" href="/#events">
              <span className="hero-card-icon">
                <CalendarDays size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="hero-card-body">
                <span className="hero-card-title">Upcoming Event</span>
                <span className="hero-card-sub">
                  {event
                    ? `${event.title} · ${formatDateTime(event.starts_at)}`
                    : "No events scheduled"}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
            </Link>

            <Link className="hero-card glass anim-card" href="/#amenities">
              <span className="hero-card-icon">
                <SiteIcon name="leaf" size={20} />
              </span>
              <span className="hero-card-body">
                <span className="hero-card-title">Amenities</span>
                <span className="hero-card-sub">Discover facilities</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
            </Link>

            {society.emergencyPhone ? (
              <a
                className="hero-card glass anim-card"
                href={`tel:${society.emergencyPhone.replace(/\s+/g, "")}`}
              >
                <span className="hero-card-icon">
                  <Phone size={20} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="hero-card-body">
                  <span className="hero-card-title">Emergency Contact</span>
                  <span className="hero-card-sub">{society.emergencyPhone}</span>
                </span>
                <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero-bottom">
          {video ? <HeroMediaPill video={video} /> : <span />}

          <ul className="amenity-strip glass" aria-label="Society highlights">
            {society.amenities.map((amenity) => (
              <li key={amenity.label}>
                <SiteIcon name={amenity.icon} size={20} />
                <span>{amenity.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="site-main">
        {/* ------------------------------------------------------------- about */}
        <section className="site-section" id="about">
          <h2 className="site-h2">{society.about.title}</h2>
          <div className="section-rule" />
          <div className="about-grid">
            <div className="stack-sm">
              {society.about.paragraphs.map((paragraph) => (
                <p className="site-p" key={paragraph.slice(0, 24)}>
                  {paragraph}
                </p>
              ))}
            </div>
            {society.established || society.units ? (
              <dl className="stat-card glass">
                {society.established ? (
                  <div>
                    <dt>Established</dt>
                    <dd className="display">{society.established}</dd>
                  </div>
                ) : null}
                {society.units ? (
                  <div>
                    <dt>Flats</dt>
                    <dd className="display">{society.units}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </section>

        {/* --------------------------------------------------------- amenities */}
        <section className="site-section" id="amenities">
          <h2 className="site-h2">Amenities</h2>
          <div className="section-rule" />
          <ul className="amenity-grid">
            {society.amenities.map((amenity) => (
              <li className="amenity-card glass" key={amenity.label}>
                <span className="amenity-icon">
                  <SiteIcon name={amenity.icon} size={24} />
                </span>
                {amenity.label}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ events */}
        <section className="site-section" id="events">
          <h2 className="site-h2">Events</h2>
          <div className="section-rule" />
          {events.length === 0 ? (
            <p className="empty-line">No events scheduled yet.</p>
          ) : (
            <ul className="card-grid">
              {events.map((item) => (
                <li className="content-card glass" key={item.id}>
                  <span className="content-card-meta">
                    <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
                    {formatDateTime(item.starts_at)}
                  </span>
                  <h3 className="content-card-title">{item.title}</h3>
                  {item.venue ? (
                    <p className="content-card-sub">
                      <MapPin size={14} strokeWidth={1.7} aria-hidden="true" />
                      {item.venue}
                    </p>
                  ) : null}
                  {item.description ? (
                    <p className="site-p">{item.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------------------- notices */}
        <section className="site-section" id="notices">
          <h2 className="site-h2">Notices</h2>
          <div className="section-rule" />
          {notices.length === 0 ? (
            <p className="empty-line">No notices yet.</p>
          ) : (
            <ul className="notice-list">
              {notices.map((item) => (
                <li className="notice-row glass" key={item.id}>
                  <div className="notice-head">
                    {item.pinned ? (
                      <span className="notice-pin">Pinned</span>
                    ) : null}
                    <h3 className="content-card-title">{item.title}</h3>
                    <span className="tiny dim">
                      {formatDateTime(item.published_at)}
                    </span>
                  </div>
                  {item.body ? <p className="site-p">{item.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------------------- gallery */}
        <section className="site-section" id="gallery">
          <h2 className="site-h2">Gallery</h2>
          <div className="section-rule" />
          {society.gallery.length === 0 ? (
            <p className="empty-line">
              Photos will appear here once the committee adds them.
            </p>
          ) : (
            <GalleryGrid images={[...society.gallery]} />
          )}
        </section>

        {/* ----------------------------------------------------------- contact */}
        <section className="site-section" id="contact">
          <h2 className="site-h2">Contact</h2>
          <div className="section-rule" />
          <div className="contact-grid">
            <ul className="contact-list">
              {contact.address ? (
                <li>
                  <MapPin size={17} strokeWidth={1.6} aria-hidden="true" />
                  <span>{contact.address}</span>
                </li>
              ) : null}
              {society.emergencyPhone ? (
                <li>
                  <Phone size={17} strokeWidth={1.6} aria-hidden="true" />
                  <a href={`tel:${society.emergencyPhone.replace(/\s+/g, "")}`}>
                    {society.emergencyPhone}
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li>
                  <Mail size={17} strokeWidth={1.6} aria-hidden="true" />
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              ) : null}
              {!contact.address && !contact.email && !society.emergencyPhone ? (
                <li className="empty-line">
                  Contact details will be published here once the committee
                  confirms them.
                </li>
              ) : null}
            </ul>

            {society.committee.length > 0 ? (
              <ul className="committee-list glass">
                {society.committee.map((member) => (
                  <li key={`${member.name}-${member.role}`}>
                    <span className="committee-name">{member.name}</span>
                    <span className="committee-role">
                      {member.role}
                      {member.flat ? ` · ${member.flat}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <LotusMark size={26} />
        <p>
          {society.name} · {society.tagline}
        </p>
        <p className="tiny dim">
          Complaint triage by {modelLabel} ·{" "}
          <Link className="footer-link" href="/login">
            {signedIn ? "Open dashboard" : "Resident sign in"}
          </Link>
        </p>
      </footer>
    </div>
  );
}
