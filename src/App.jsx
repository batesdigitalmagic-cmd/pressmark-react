import { useState, useEffect, useRef } from "react";
import spreadsheetHeroImage from "./assets/Spreadsheet flowing into publication pages.png";
import classOf27HeroImage from "./assets/class of 27 hero image.png";
import heroMergePhotosImage from "./assets/hero image merge photos.png";
import professionalReviewingImage from "./assets/professional reviewing.png";
import tornadoImage from "./assets/tornado .png";
import sunnyImage from "./assets/sunny.png";
import yearbookPhotosImage from "./assets/yearbook photos.png";
import yearbookOpenImage from "./assets/year book open.png";
import yearbookDetailImage from "./assets/Bates_Digital_yearbook_with_pictures_--v_7_4defa031-d9f3-47a7-a62d-ea91f7682e52_1.png";
import churchDirectoryCoverImage from "./assets/church directory pbcover.png";
import directoryLineupImage from "./assets/directory_book_of_name_contact_lined_up_like_of_c91c9532-7f3b-42d6-94e6-b81e40391ffb_1.png";
import touchscreenIdsImage from "./assets/touchscreen ids.png";
import puttingBooksImage from "./assets/puttinng books in the box.png";
import studioProfessionalImage from "./assets/young_black_professional_in_lighted_studio_maki_c2a7974b-4503-4289-bcb6-4d706398e10b_1.png";
import pressmarkLogo from "./assets/pressmark studio logo main.png";
import pricingGuideImage from "./assets/Pressmark Studio pricing guide.png";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Why Us", href: "#why" },
  { label: "Process", href: "#process" },
  { label: "Pricing", href: "#pricing" },
];

const SERVICES = [
  {
    num: "01",
    icon: "📚",
    title: "Yearbook Design",
    flagship: true,
    desc: "Beautiful, organized yearbooks that celebrate students, teams, activities, achievements, and the moments people want to remember.",
    img: "yearbook",
  },
  {
    num: "02",
    icon: "📇",
    title: "Directory Design",
    flagship: false,
    desc: "Professional directories designed for schools, churches, associations, nonprofits, membership groups, and community organizations.",
    img: "directory",
  },
  {
    num: "03",
    icon: "📊",
    title: "Portrait Data Merge",
    flagship: false,
    desc: "Automatically place portraits, names, grades, titles, and custom information across hundreds of pages with accuracy and consistency.",
    img: "event",
  },
  {
    num: "04",
    icon: "✏️",
    title: "Publication Cleanup",
    flagship: false,
    desc: "Already started the project? We'll organize files, repair layouts, fix formatting issues, and get everything back on track.",
    img: "redesign",
  },
  {
    num: "05",
    icon: "🖨️",
    title: "Print Production",
    flagship: false,
    desc: "Production-ready PDFs, bleeds, margins, image checks, file packaging, and commercial print preparation for confident delivery.",
    img: "print",
  },
];

const WHY = [
  { icon: "📊", title: "Portrait Data Management", desc: "We help organize large portrait sets, names, grades, titles, and custom spreadsheet fields before layout begins." },
  { icon: "🧹", title: "Publication Cleanup", desc: "Messy files, broken layouts, missing images, and inconsistent formatting can be repaired and brought back under control." },
  { icon: "📇", title: "Directory Organization", desc: "Large directories stay easier to navigate with clear systems for sections, listings, names, and supporting information." },
  { icon: "🖨️", title: "Production-Ready Files", desc: "Final files are prepared with print requirements, image resolution, bleed, trim, packaging, and export in mind." },
  { icon: "⚡", title: "Fast Turnaround", desc: "Complex publication projects move more smoothly with structured workflows and reliable communication." },
  { icon: "🎯", title: "Quality Control", desc: "We review the details that can cause costly mistakes before your files reach the printer." },
];

const PROCESS = [
  { num: "01", title: "Organize", desc: "We gather the photos, records, and content that matter." },
  { num: "02", title: "Design", desc: "We turn complex information into a publication people can navigate and trust." },
  { num: "03", title: "Deliver", desc: "You receive a polished publication ready to share, distribute, or print." },
];

const AUDIENCES = [
  "Schools","Athletic Programs","Churches","Nonprofits",
  "Associations","Community Organizations","Government Agencies","Membership Groups",
];

const PRICING = [
  ["Church Directory", "$1,500–$5,000"],
  ["Organization Directory", "$2,000–$8,000"],
  ["Government Directory", "$3,000–$15,000+"],
  ["Yearbook Production Support", "$2,500–$12,000+"],
  ["Publication Rescue Projects", "Custom Quote"],
];

const ADD_ONS = [
  ["Additional Page Design", "$15-25/page"],
  ["Cover Design Only", "$350"],
  ["Data Merge Setup", "$250+"],
  ["Portrait Placement", "$150+"],
  ["Print Coordination", "$250"],
  ["Rush Service", "+25%"],
  ["Additional Revisions", "$75/hr"],
];

const INCLUDED = [
  "Professional Layout Design",
  "Typography & Styling",
  "Adobe InDesign Production",
  "Print-Ready PDF Delivery",
  "Font Packaging",
  "Bleed & Trim Setup",
  "Press Optimization",
];

/* ─────────────────────────────────────────────
   IMAGE PLACEHOLDER COMPONENT
───────────────────────────────────────────── */
const IMG_COLORS = {
  yearbook:  { bg: "#020814", accent: "#aa7d48", label: "Yearbook Design" },
  directory: { bg: "#051225", accent: "#aa7d48", label: "Directory Publication" },
  event:     { bg: "#081a33", accent: "#aa7d48", label: "Event Program" },
  print:     { bg: "#06162c", accent: "#aa7d48", label: "Print Production" },
  redesign:  { bg: "#071a33", accent: "#aa7d48", label: "Publication Redesign" },
  hero:      { bg: "#020814", accent: "#aa7d48", label: "Publication Showcase" },
  about:     { bg: "#051225", accent: "#aa7d48", label: "Studio at Work" },
  portfolio1:{ bg: "#020814", accent: "#aa7d48", label: "Yearbook · 176 pages" },
  portfolio2:{ bg: "#051225", accent: "#aa7d48", label: "Anniversary Book · 144 pages" },
  portfolio3:{ bg: "#081a33", accent: "#aa7d48", label: "Event Program · 48 pages" },
};

const IMG_ASSETS = {
  hero: { src: spreadsheetHeroImage, alt: "Spreadsheet data flowing into finished publication pages" },
  about: { src: studioProfessionalImage, alt: "Young Black professional in a lighted studio" },
  yearbook: { src: yearbookPhotosImage, alt: "Yearbook photos publication design sample" },
  directory: { src: churchDirectoryCoverImage, alt: "Church directory cover publication sample" },
  event: { src: touchscreenIdsImage, alt: "Touchscreen IDs and portrait data merge interface" },
  print: { src: puttingBooksImage, alt: "Printed books being packed for delivery" },
  redesign: { src: classOf27HeroImage, alt: "Class of 2027 publication cleanup sample" },
  portfolio1: { src: yearbookOpenImage, alt: "Open yearbook publication portfolio sample" },
  portfolio2: { src: professionalReviewingImage, alt: "Professional reviewing publication pages" },
  portfolio3: { src: yearbookDetailImage, alt: "Event program publication portfolio sample" },
};

const PALETTE = {
  base: "#020814",
  panel: "#051225",
  panelSoft: "#081a33",
  accent: "#aa7d48",
  accentSoft: "#aa7d48",
  text: "#ffffff",
  textMuted: "#b7c7df",
  border: "rgba(170,125,72,0.24)",
  black: "#000000",
  white: "#ffffff",
};

const FONT_STACK = "'Cormorant Garamond', Georgia, serif";
const PAGE_X = "clamp(1.25rem, 5vw, 4rem)";

function ImgPlaceholder({ type = "hero", style = {}, className = "", aspectRatio = "4/3" }) {
  const c = IMG_COLORS[type] || IMG_COLORS.hero;
  const asset = IMG_ASSETS[type];

  if (asset) {
    return (
      <div
        className={className}
        style={{
          background: c.bg,
          aspectRatio,
          position: "relative",
          overflow: "hidden",
          borderRadius: 2,
          ...style,
        }}
      >
        <img
          src={asset.src}
          alt={asset.alt}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: c.bg,
        aspectRatio,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        ...style,
      }}
    >
      {/* decorative grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`g-${type}`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={c.accent} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#g-${type})`} />
      </svg>
      {/* decorative circle */}
      <div style={{ position: "absolute", width: "60%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${c.accent}`, opacity: 0.18 }} />
      <div style={{ position: "absolute", width: "35%", aspectRatio: "1", borderRadius: "50%", border: `1px solid ${c.accent}`, opacity: 0.25 }} />
      {/* icon */}
      <div style={{
        width: 56, height: 56, borderRadius: 4,
        background: c.accent + "22",
        border: `1px solid ${c.accent}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12, position: "relative", zIndex: 1,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
          <circle cx="6" cy="6" r="1" fill={c.accent} />
        </svg>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c.accent, position: "relative", zIndex: 1 }}>
        {c.label}
      </div>
      <div style={{ fontSize: 10, color: c.accent + "88", marginTop: 4, position: "relative", zIndex: 1, letterSpacing: "0.08em" }}>
        [ Image Placeholder ]
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SCROLL FADE HOOK
───────────────────────────────────────────── */
function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, visible] = useFadeIn();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [quoteForm, setQuoteForm] = useState({
    name: "",
    email: "",
    organization: "",
    publicationType: "",
    estimatedPageCount: "",
    deadline: "",
    projectDetails: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  const emailQuote = () => {
    setMenuOpen(false);
    window.location.href = "mailto:quotes@pressmark.studio?subject=Quote%20Request";
  };

  const updateQuoteForm = (field, value) => {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  };

  const sendQuoteRequest = async () => {
    setFormSubmitting(true);
    setFormError("");

    const formData = new FormData();
    formData.append("_subject", "Pressmark Studio Quote Request");
    formData.append("Name", quoteForm.name);
    formData.append("Email Address", quoteForm.email);
    formData.append("Organization", quoteForm.organization);
    formData.append("Publication Type", quoteForm.publicationType);
    formData.append("Estimated Page Count", quoteForm.estimatedPageCount);
    formData.append("Deadline", quoteForm.deadline);
    formData.append("Project Details", quoteForm.projectDetails);
    if (fileInputRef.current?.files?.[0]) {
      formData.append("Upload Files", fileInputRef.current.files[0]);
    }

    try {
      const response = await fetch("https://formsubmit.co/ajax/quotes@pressmark.studio", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Quote request failed");
      }

      setFormSent(true);
      setQuoteForm({
        name: "",
        email: "",
        organization: "",
        publicationType: "",
        estimatedPageCount: "",
        deadline: "",
        projectDetails: "",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setFormError("Something went wrong. Please email quotes@pressmark.studio directly.");
    } finally {
      setFormSubmitting(false);
    }
  };

  /* ── STYLES (inline for portability) ── */
  const S = {
    root: {
      fontFamily: FONT_STACK,
      background: PALETTE.base,
      color: PALETTE.text,
      margin: 0,
      padding: 0,
      overflowX: "hidden",
    },
    // NAV
    nav: {
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: scrolled ? "rgba(2,8,20,0.97)" : "rgba(2,8,20,0.78)",
      backdropFilter: "blur(16px)",
      borderBottom: scrolled ? `1px solid ${PALETTE.border}` : "1px solid transparent",
      transition: "all 0.3s ease",
      padding: `0 ${PAGE_X} 0 0`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: 68,
    },
    logo: {
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
    },
    logoImage: {
      display: "block",
      width: "clamp(140px, 18vw, 190px)",
      height: "auto",
      maxHeight: 42,
      objectFit: "contain",
    },
    navLinks: {
      display: "flex", gap: "2rem", listStyle: "none",
      margin: 0, padding: 0,
    },
    navLink: {
      fontSize: "0.78rem", fontWeight: 500,
      letterSpacing: "0.1em", textTransform: "uppercase",
      color: PALETTE.textMuted, textDecoration: "none", cursor: "pointer",
      transition: "color 0.2s",
      background: "none", border: "none",
    },
    navCta: {
      fontSize: "0.75rem", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: PALETTE.black, background: PALETTE.accent,
      padding: "0.55rem 1.3rem", border: "none",
      cursor: "pointer", transition: "background 0.2s",
      textDecoration: "none",
    },
    hamburger: {
      background: "none", border: "none", cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 5,
      padding: "4px 0",
    },
    hamburgerLine: (open, i) => ({
      width: 24, height: 2, background: PALETTE.text,
      transition: "all 0.3s ease",
      transform: open
        ? i === 0 ? "rotate(45deg) translate(5px,5px)"
        : i === 2 ? "rotate(-45deg) translate(5px,-5px)" : "scaleX(0)"
        : "none",
      opacity: open && i === 1 ? 0 : 1,
    }),
    mobileMenu: {
      position: "fixed", top: 68, left: 0, right: 0, zIndex: 190,
      background: PALETTE.panel,
      borderBottom: `1px solid ${PALETTE.border}`,
      padding: `1.5rem ${PAGE_X} 2rem`,
      transform: menuOpen ? "translateY(0)" : "translateY(-120%)",
      transition: "transform 0.35s ease",
      display: "flex", flexDirection: "column", gap: "0.25rem",
    },
    mobileNavLink: {
      fontSize: "1rem", fontWeight: 500,
      color: PALETTE.text, textDecoration: "none",
      padding: "0.75rem 0",
      borderBottom: `1px solid ${PALETTE.border}`,
      background: "none", border: "none", textAlign: "left",
      cursor: "pointer", letterSpacing: "0.04em",
    },
    mobileCta: {
      marginTop: "1rem",
      fontSize: "0.82rem", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: PALETTE.black, background: PALETTE.accent,
      padding: "0.85rem 1.5rem", border: "none",
      cursor: "pointer", textAlign: "center",
    },

    // SECTIONS
    section: (bg = PALETTE.panelSoft) => ({
      background: bg,
      padding: `clamp(4rem, 10vw, 7rem) ${PAGE_X}`,
    }),
    container: {
      width: "100%",
      maxWidth: "none",
      margin: "0 auto",
    },
    eyebrow: (light = false) => ({
      fontSize: "0.7rem", fontWeight: 600,
      letterSpacing: "0.2em", textTransform: "uppercase",
      color: PALETTE.accent, marginBottom: "1rem",
      display: "flex", alignItems: "center", gap: "0.75rem",
    }),
    eyebrowLine: { width: 28, height: 1, background: PALETTE.accent, display: "inline-block", flexShrink: 0 },
    h2: (light = false) => ({
      fontFamily: FONT_STACK,
      fontSize: "clamp(2rem, 4vw, 3rem)",
      fontWeight: 900, lineHeight: 1.1,
      color: light ? PALETTE.white : PALETTE.text,
      margin: "0 0 1.2rem",
    }),
    lead: (light = false) => ({
      fontSize: "clamp(0.95rem, 2vw, 1.05rem)",
      lineHeight: 1.8, color: light ? "rgba(255,255,255,0.78)" : PALETTE.textMuted,
      maxWidth: 560,
    }),

    btnPrimary: {
      fontSize: "0.78rem", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: PALETTE.black, background: PALETTE.accent,
      padding: "0.9rem 1.8rem", border: "none",
      cursor: "pointer", transition: "background 0.2s",
      textDecoration: "none", display: "inline-block",
    },
    btnGhost: (light = false) => ({
      fontSize: "0.78rem", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: light ? PALETTE.white : PALETTE.text,
      background: "transparent",
      border: `1px solid ${light ? "rgba(255,255,255,0.32)" : "rgba(170,125,72,0.28)"}`,
      padding: "0.9rem 1.8rem",
      cursor: "pointer", transition: "all 0.2s",
      textDecoration: "none", display: "inline-block",
    }),
  };

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
        p { color: #ffffff !important; }
        .pricing-print-guide { display: none; }
        button:focus-visible, a:focus-visible { outline: 2px solid #aa7d48; outline-offset: 2px; }
        .nav-link-hover:hover { color: #aa7d48 !important; }
        .btn-primary-hover:hover { background: #aa7d48 !important; }
        .btn-ghost-hover:hover { border-color: #aa7d48 !important; color: #aa7d48 !important; }
        .service-card:hover { background: rgba(170,125,72,0.12) !important; }
        .service-card:hover .service-num { color: #aa7d48 !important; }
        .why-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(3,10,23,0.26) !important; }
        .audience-tag:hover { background: #051225 !important; color: #aa7d48 !important; border-color: #051225 !important; }
        @media (max-width: 900px) {
          .hero-section {
            min-height: 78vh !important;
            background-position: center top !important;
            background-image: linear-gradient(180deg, rgba(2,8,20,0.72) 0%, rgba(2,8,20,0.86) 42%, rgba(2,8,20,0.98) 100%), url(${heroMergePhotosImage}) !important;
          }
          .hero-copy h1,
          .hero-copy p { text-align: center !important; }
          .hero-copy { margin: 0 auto !important; }
          .hero-copy .hero-buttons { justify-content: center !important; }
          .about-grid { grid-template-columns: 1fr !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .process-steps { grid-template-columns: repeat(2, minmax(220px, 1fr)) !important; }
          .process-connector { display: none !important; }
          .cta-grid { grid-template-columns: 1fr !important; text-align: center; }
          .cta-btns { justify-content: center !important; }
          .footer-inner { flex-direction: column !important; gap: 1rem !important; text-align: center; }
          .audience-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .portfolio-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .site-logo-image { transform: translateX(-1.5rem); }
        }
        @media (max-width: 540px) {
          .why-grid { grid-template-columns: 1fr !important; }
          .audience-grid { grid-template-columns: 1fr !important; }
          .process-steps { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media print {
          @page {
            size: letter portrait;
            margin: 0.25in;
          }
          html, body {
            width: 8in !important;
            height: 10.5in !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          body * { visibility: hidden !important; }
          #pricing {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 8in !important;
            height: 10.5in !important;
            background: #ffffff !important;
            padding: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #pricing .pricing-print-guide,
          #pricing .pricing-print-guide * {
            visibility: visible !important;
          }
          #pricing .pricing-print-guide {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 8in !important;
            height: 10.5in !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            background: #ffffff !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
          #pricing .pricing-print-guide img {
            display: block !important;
            width: auto !important;
            height: 10.5in !important;
            max-width: 8in !important;
            max-height: 10.5in !important;
            margin: 0 auto !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <button style={S.logo} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Pressmark Studio home">
          <img className="site-logo-image" src={pressmarkLogo} alt="Pressmark Studio" style={S.logoImage} />
        </button>
        <ul className="desktop-nav" style={S.navLinks}>
          {NAV_LINKS.map(l => (
            <li key={l.label}>
              <button className="nav-link-hover" style={S.navLink} onClick={() => scrollTo(l.href)}>
                {l.label}
              </button>
            </li>
          ))}
        </ul>
        <button className="desktop-nav btn-primary-hover" style={S.navCta} onClick={emailQuote}>
          Get a Quote
        </button>
        <button className="hamburger-btn" style={{ ...S.hamburger, display: "none" }} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
          {[0,1,2].map(i => <span key={i} style={S.hamburgerLine(menuOpen, i)} />)}
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      <div style={S.mobileMenu}>
        {NAV_LINKS.map(l => (
          <button key={l.label} style={S.mobileNavLink} onClick={() => scrollTo(l.href)}>{l.label}</button>
        ))}
        <button className="btn-primary-hover" style={S.mobileCta} onClick={emailQuote}>
          Get a Quote →
        </button>
      </div>

      {/* ── HERO ── */}
      <section className="hero-section" style={{
        position: "relative",
        minHeight: "86vh",
        paddingTop: 68,
        display: "flex",
        alignItems: "center",
        backgroundImage: `linear-gradient(90deg, rgba(2,8,20,0.96) 0%, rgba(2,8,20,0.78) 43%, rgba(2,8,20,0.28) 72%, rgba(2,8,20,0.7) 100%), url(${heroMergePhotosImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}>
        <div style={{ padding: `clamp(4rem,8vw,6.5rem) ${PAGE_X}`, ...S.container }}>
          <div className="hero-copy" style={{ maxWidth: 680, margin: 0 }}>
            <h1 style={{
              fontFamily: FONT_STACK,
              fontSize: "clamp(3.1rem, 7vw, 6.4rem)",
              fontWeight: 900,
              lineHeight: 0.94,
              letterSpacing: "0.04em",
              color: PALETTE.white,
              margin: "0 0 1.4rem",
              textAlign: "left",
            }}>
              When Your Publication Has to Be <em style={{ color: PALETTE.accent }}>Right.</em>
            </h1>
            <p style={{
              fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.82)",
              margin: "0 0 2rem",
              maxWidth: 600,
              textAlign: "left",
            }}>
              Yearbooks, directories, data merge projects, and publication cleanup handled with production-ready precision.
            </p>
            <div className="hero-buttons" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "flex-start" }}>
              <button className="btn-primary-hover" style={{
                ...S.btnPrimary,
                borderRadius: 999,
                padding: "0.95rem 2rem",
                color: PALETTE.base,
              }} onClick={emailQuote}>
                REQUEST A QUOTE
              </button>
              <button className="btn-ghost-hover" style={{
                ...S.btnGhost(true),
                borderRadius: 999,
                padding: "0.95rem 2rem",
                background: "rgba(2,8,20,0.34)",
                borderColor: "rgba(255,255,255,0.58)",
              }} onClick={() => scrollTo("#services")}>
                VIEW SERVICES
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ background: PALETTE.panel, padding: `2rem ${PAGE_X}`, borderTop: `1px solid ${PALETTE.border}`, borderBottom: `1px solid ${PALETTE.border}` }}>
        <div style={{ ...S.container, textAlign: "center" }}>
          <div style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.35rem, 3vw, 2rem)", fontWeight: 800, color: PALETTE.white, marginBottom: "0.7rem" }}>
            Trusted By Organizations That Need Accuracy
          </div>
          <div style={{ color: PALETTE.accent, fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.8 }}>
            Schools • Athletic Programs • Churches • Nonprofits • Associations • Community Organizations • Government Agencies
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section style={S.section(PALETTE.base)}>
        <div style={{ ...S.container, textAlign: "center" }}>
          <FadeIn>
            <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
              <span style={S.eyebrowLine} />
              Publication Rescue
              <span style={S.eyebrowLine} />
            </div>
            <h2 style={{ ...S.h2(true), marginBottom: "1.4rem" }}>
              Design Isn't The Problem.<br />
              <em style={{ color: PALETTE.accent }}>Organization Is.</em>
            </h2>
            <div style={{ maxWidth: 980, margin: "0 auto 1.8rem", overflow: "hidden", border: `1px solid ${PALETTE.border}`, borderRadius: 4, background: PALETTE.panel, boxShadow: "0 18px 48px rgba(0,0,0,0.28)" }}>
              <img src={tornadoImage} alt="Publication project needing organization" style={{ display: "block", width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem", margin: "0 auto 1.6rem", maxWidth: 900 }}>
              {["Portraits are missing.", "Spreadsheets don't match.", "Names are incorrect.", "Layouts become difficult to manage.", "Deadlines get closer."].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 86, border: `1px solid ${PALETTE.border}`, background: "rgba(255,255,255,0.04)", padding: "1rem", color: PALETTE.white, fontWeight: 700, lineHeight: 1.35 }}>
                  {item}
                </div>
              ))}
            </div>
            <p style={{ ...S.lead(true), maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
              Pressmark Studio brings structure to the process by combining publication design expertise with real-world production experience.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={S.section(PALETTE.panelSoft)}>
        <div style={S.container}>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(2.5rem,6vw,6rem)", alignItems: "center" }}>

            <FadeIn>
              <div style={{ position: "relative" }}>
                <ImgPlaceholder type="about" aspectRatio="3/4" style={{ width: "100%", borderRadius: 4 }} />
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                About Pressmark Studio
              </div>
              <h2 style={S.h2()}>
                More Than Design.<br />
                <em style={{ color: PALETTE.accentSoft }}>We Understand Production.</em>
              </h2>
              <p style={{ ...S.lead(), marginBottom: "1.5rem", maxWidth: 560, margin: "0 auto 1.5rem", textAlign: "left" }}>
                At Pressmark Studio, we specialize in publication design and production services for schools, teams, nonprofits, churches, associations, and organizations.
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: PALETTE.textMuted, marginBottom: "2rem", maxWidth: 560, margin: "0 auto 2rem", textAlign: "left" }}>
                We understand that successful publications require more than attractive layouts. They require organization. From portrait databases and spreadsheets to page layouts and print-ready files, every part of the publication process must work together.
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.8, color: PALETTE.textMuted, marginBottom: "2rem", maxWidth: 560, margin: "0 auto 2rem", textAlign: "left" }}>
                Our goal is simple: create publications that look professional, stay organized, and print correctly the first time.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem 1.5rem", maxWidth: 560, margin: "0 auto", width: "100%" }}>
                {[
                  "Portrait data management","Publication cleanup",
                  "Directory organization","Production-ready files",
                  "Commercial print experience","Fast turnaround",
                  "Reliable communication","Quality control",
                ].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <div style={{
                      width: 20, height: 20, background: PALETTE.accent, borderRadius: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1, fontSize: "0.7rem", color: PALETTE.base, fontWeight: 700,
                    }}>✓</div>
                    <span style={{ fontSize: "0.88rem", color: PALETTE.accentSoft, lineHeight: 1.5, textAlign: "left" }}>{item}</span>
                  </div>
                ))}
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" style={S.section(PALETTE.panel)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", flexWrap: "wrap", gap: "1.5rem", marginBottom: "3.5rem", paddingBottom: "2.5rem", borderBottom: `1px solid ${PALETTE.border}` }}>
              <div style={{ textAlign: "center", width: "100%", maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ ...S.eyebrow(), justifyContent: "center", alignSelf: "center" }}>
                  <span style={S.eyebrowLine} />
                  What We Do
                  <span style={S.eyebrowLine} />
                </div>
                <h2 style={{ ...S.h2(), marginBottom: 0 }}>Professional Publication<br /><em style={{ color: PALETTE.accent }}>Services</em></h2>
              </div>
              <p style={{ ...S.lead(), maxWidth: 560, margin: "0 auto", textAlign: "center", fontSize: "0.95rem" }}>
                Publication design, data merge, directory design, cleanup, and print production support for complex multi-page projects.
              </p>
            </div>
          </FadeIn>

          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", alignItems: "stretch", gap: 0, border: `1px solid ${PALETTE.border}` }}>
            {SERVICES.map((s, i) => (
              <FadeIn key={s.num} delay={i * 0.08}>
                <div className="service-card" style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  padding: "2.5rem 2rem",
                  borderRight: (i + 1) % 3 !== 0 ? `1px solid ${PALETTE.border}` : "none",
                  borderBottom: i < 3 ? `1px solid ${PALETTE.border}` : "none",
                  transition: "background 0.3s",
                }}>
                  <ImgPlaceholder type={s.img} aspectRatio="16/9" style={{ marginBottom: "1.25rem", borderRadius: 3 }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <span className="service-num" style={{ fontFamily: FONT_STACK, fontSize: "0.75rem", fontWeight: 700, color: PALETTE.textMuted, letterSpacing: "0.1em", transition: "color 0.3s" }}>{s.num}</span>
                    {s.flagship && (
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: PALETTE.panel, color: PALETTE.accent, padding: "0.2rem 0.55rem" }}>
                        ★ Flagship
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "1.6rem", marginBottom: "0.6rem" }}>{s.icon}</div>
                  <div style={{ fontFamily: FONT_STACK, fontSize: "1rem", fontWeight: 700, color: PALETTE.accentSoft, marginBottom: "0.6rem", lineHeight: 1.3 }}>{s.title}</div>
                  <div style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "#ffffff" }}>{s.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section id="why" style={S.section(PALETTE.base)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                Why Choose Us
                <span style={S.eyebrowLine} />
              </div>
              <h2 style={S.h2(true)}>
                Design Expertise Meets<br />
                <em style={{ color: PALETTE.accent }}>Production Experience</em>
              </h2>
              <p style={{ ...S.lead(true), maxWidth: 760, margin: "1rem auto 0", textAlign: "center" }}>
                Many designers understand layouts. Few understand how publications are built, organized, prepared, and delivered for production.
              </p>
              <img
                src={spreadsheetHeroImage}
                alt="Spreadsheet flowing into publication pages"
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 980,
                  aspectRatio: "16/9",
                  objectFit: "cover",
                  objectPosition: "center 80%",
                  margin: "2rem auto 0",
                  border: `1px solid ${PALETTE.border}`,
                  borderRadius: 4,
                  boxShadow: "0 18px 48px rgba(0,0,0,0.28)",
                }}
              />
            </div>
          </FadeIn>

          <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", alignItems: "stretch", gap: "1.5rem" }}>
            {WHY.map((w, i) => (
              <FadeIn key={w.title} delay={i * 0.1}>
                <div className="why-card" style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "2rem 1.75rem",
                  borderRadius: 4,
                  transition: "all 0.3s ease",
                  boxShadow: "0 0 0 rgba(3,10,23,0)",
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{w.icon}</div>
                  <div style={{ fontFamily: FONT_STACK, fontSize: "1.05rem", fontWeight: 700, color: PALETTE.accentSoft, marginBottom: "0.6rem" }}>{w.title}</div>
                  <div style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "#ffffff" }}>{w.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section id="process" style={S.section(PALETTE.panelSoft)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{
              textAlign: "center",
              margin: "0 auto 4rem",
              maxWidth: 680,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center", alignSelf: "center" }}>
                <span style={S.eyebrowLine} />
                How It Works
                <span style={S.eyebrowLine} />
              </div>
              <h2 style={{ ...S.h2(), width: "100%", textAlign: "center", whiteSpace: "nowrap", fontSize: "clamp(1.7rem, 5vw, 3rem)" }}>Organize <em style={{ color: PALETTE.accent }}>→</em> Design <em style={{ color: PALETTE.accent }}>→</em> Deliver</h2>
            </div>
          </FadeIn>

          <div className="process-steps" style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 760px)",
            gap: "1rem",
            justifyContent: "center",
            justifyItems: "center",
            alignItems: "center",
            position: "relative",
            width: "100%",
            margin: "0 auto",
          }}>
            {PROCESS.map((p, i) => (
              <div key={p.title} style={{ width: "100%" }}>
                <FadeIn delay={i * 0.12} style={{ width: "100%" }}>
                  <div style={{
                    textAlign: "center",
                    padding: "clamp(1.5rem, 4vw, 2.4rem)",
                    border: `1px solid ${PALETTE.border}`,
                    background: "rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 900, color: PALETTE.accentSoft, marginBottom: "0.75rem" }}>{p.title}</div>
                    <div style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.7, color: "#ffffff", maxWidth: 580, margin: "0 auto" }}>{p.desc}</div>
                  </div>
                </FadeIn>
                {i < PROCESS.length - 1 && (
                  <div style={{ fontFamily: FONT_STACK, fontSize: "2rem", fontWeight: 900, color: PALETTE.accent, lineHeight: 1, margin: "1rem 0" }}>↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUDIENCES ── */}
      <section style={S.section(PALETTE.panel)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                Who We Serve
                <span style={S.eyebrowLine} />
              </div>
              <h2 style={S.h2()}>Perfect For</h2>
            </div>
          </FadeIn>
          <div className="audience-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "1fr", alignItems: "stretch", gap: "1rem" }}>
            {AUDIENCES.map((a, i) => (
              <FadeIn key={a} delay={i * 0.06}>
                <div className="audience-tag" style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  padding: "1.25rem 1.5rem",
                  border: `1px solid ${PALETTE.border}`,
                  textAlign: "center",
                  fontFamily: FONT_STACK,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: PALETTE.base,
                  cursor: "default",
                  transition: "all 0.25s ease",
                  borderRadius: 2,
                  background: PALETTE.white,
                }}>
                  {a}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO TEASER ── */}
      <section style={S.section(PALETTE.base)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "1.5rem", marginBottom: "2.5rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                  <span style={S.eyebrowLine} />
                  Recent Work
                  <span style={S.eyebrowLine} />
                </div>
                <h2 style={{ ...S.h2(true), marginBottom: 0 }}>
                  Publications <em style={{ color: PALETTE.accent }}>people keep.</em>
                </h2>
              </div>
              <button className="btn-ghost-hover" style={S.btnGhost(true)} onClick={() => scrollTo("#contact")}> 
                Start Your Project
              </button>
            </div>
          </FadeIn>
          <div className="portfolio-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gridAutoRows: "1fr", gap: "1.2rem", justifyContent: "center" }}>
            {[{
              type: "portfolio1", label: "Yearbook · 176 pages", title: "The Bruin 2024 — Beaumont High School" },
              { type: "portfolio2", label: "Commemorative Book · 144 pages", title: "Legacy Celebration — 125th Anniversary" },
              { type: "portfolio3", label: "Event Program · 48 pages", title: "NPHC Greek Gala Evening Program" },
            ].map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.1}>
                <div style={{ position: "relative", borderRadius: 4, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
                  <ImgPlaceholder type={p.type} aspectRatio={"3/4"} style={{ width: "100%" }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(3,10,23,0.92) 0%, transparent 55%)",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    padding: "1.5rem",
                  }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.3rem" }}>{p.label}</div>
                    <div style={{ fontFamily: FONT_STACK, fontWeight: 700, fontSize: "0.95rem", color: PALETTE.white, lineHeight: 1.35 }}>{p.title}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={S.section(PALETTE.panelSoft)}>
        <div className="pricing-print-guide">
          <img src={pricingGuideImage} alt="Pressmark Studio pricing guide" />
        </div>
        <div style={S.container}>
          <FadeIn>
            <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 3.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                Pricing Guide
                <span style={S.eyebrowLine} />
              </div>
              <h2 style={{ ...S.h2(), marginBottom: "1rem" }}>
                Typical<br /><em style={{ color: PALETTE.accent }}>Investment</em>
              </h2>
              <p style={{ ...S.lead(), margin: "0 auto 1.8rem", textAlign: "center" }}>
                Pricing depends on publication size, complexity, timeline, data condition, and production requirements.
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                <button className="btn-primary-hover" style={S.btnPrimary} onClick={() => window.print()}>
                  Download / Print Guide
                </button>
                <button className="btn-ghost-hover" style={S.btnGhost()} onClick={emailQuote}>
                  Request Custom Quote
                </button>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div style={{
              maxWidth: 920,
              margin: "0 auto",
              border: `1px solid ${PALETTE.border}`,
              borderTop: `4px solid ${PALETTE.accent}`,
              background: "rgba(2,8,20,0.42)",
              overflow: "hidden",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: PALETTE.panel, borderBottom: `1px solid ${PALETTE.border}` }}>
                <div style={{ padding: "1rem", color: PALETTE.accent, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left" }}>Publication Type</div>
                <div style={{ padding: "1rem", color: PALETTE.accent, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>Typical Range</div>
              </div>
              {PRICING.map(([type, range]) => (
                <div key={type} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center", padding: "1.1rem", borderBottom: `1px solid ${PALETTE.border}` }}>
                  <div style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.05rem, 2vw, 1.3rem)", fontWeight: 800, color: PALETTE.white, textAlign: "left" }}>{type}</div>
                  <div style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", fontWeight: 900, color: PALETTE.accent, textAlign: "right" }}>{range}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={S.section("#04142c")}>
        <div style={S.container}>
          <div className="cta-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3rem", alignItems: "center" }}>
            <FadeIn style={{ maxWidth: 560, width: "100%", justifySelf: "center", textAlign: "center" }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                Let's Get Your Publication Finished
              </div>
              <h2 style={{ ...S.h2(true), marginBottom: "1rem" }}>
                Let's Finish<br /><em style={{ color: PALETTE.accent }}>Your Publication.</em>
              </h2>
              <p style={{ ...S.lead(true), margin: "0 auto 2rem", textAlign: "center" }}>
                Get professional help organizing, designing, and preparing your next publication.
              </p>
              <img
                src={sunnyImage}
                alt="Organized publication project ready for delivery"
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 520,
                  aspectRatio: "16/10",
                  objectFit: "cover",
                  margin: "0 auto 2rem",
                  border: `1px solid ${PALETTE.border}`,
                  borderRadius: 4,
                  boxShadow: "0 18px 48px rgba(0,0,0,0.28)",
                }}
              />
              <div className="cta-btns" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
                <button className="btn-primary-hover" style={S.btnPrimary} onClick={() => scrollTo("#contact")}>
                  Request A Quote
                </button>
                <button className="btn-ghost-hover" style={S.btnGhost(true)} onClick={emailQuote}>
                  Email For A Quote
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", width: "fit-content", maxWidth: "100%", minWidth: 220, margin: "2rem auto 0", textAlign: "left" }}>
                {[["📞","Call or Text","678.790.2698"],["✉️","Email","info@pressmark.studio"],["📍","Location","Serving Nationwide"]].map(([ic,label,val]) => (
                  <div key={label} style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ fontSize: "1.2rem", width: 36, textAlign: "center" }}>{ic}</div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.8)" }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── CONTACT FORM ── */}
      <section id="contact" style={S.section(PALETTE.panel)}>
        <div style={S.container}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div style={{ ...S.eyebrow(), justifyContent: "center" }}>
                <span style={S.eyebrowLine} />
                Free Quote Request
                <span style={S.eyebrowLine} />
              </div>
              <h2 style={S.h2()}>Ready to Start Your<br /><em style={{ color: PALETTE.accent }}>Publication Project?</em></h2>
              <p style={{ ...S.lead(), margin: "0 auto", textAlign: "center" }}>Tell us about your project and receive a customized quote.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            {formSent ? (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div style={{ color: PALETTE.white, fontSize: "clamp(1.35rem, 3vw, 2rem)", fontStyle: "italic", lineHeight: 1.4 }}>
                  We'll be in touch within 24 hours.
                </div>
              </div>
            ) : (
              <div style={{ background: "#06162c", border: `1px solid ${PALETTE.border}`, padding: "clamp(2rem,5vw,3.5rem)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem" }}>
                  {[["name","Name","text","Marcus Williams"],["organization","Organization","text","Your organization name"]].map(([field,label,type,ph]) => (
                    <div key={field}>
                      <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>{label}</label>
                      <input type={type} value={quoteForm[field]} placeholder={ph} onChange={e => updateQuoteForm(field, e.target.value)} style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = PALETTE.accent} onBlur={e => e.target.style.borderColor = "rgba(170,125,72,0.24)"} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem", marginTop: "1.2rem" }}>
                  {[["email","Email Address","email","you@organization.com"],["estimatedPageCount","Estimated Page Count","text","Example: 80 pages"]].map(([field,label,type,ph]) => (
                    <div key={field}>
                      <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>{label}</label>
                      <input type={type} value={quoteForm[field]} placeholder={ph} onChange={e => updateQuoteForm(field, e.target.value)} style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = PALETTE.accent} onBlur={e => e.target.style.borderColor = "rgba(170,125,72,0.24)"} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.2rem", marginTop: "1.2rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>Publication Type</label>
                    <select value={quoteForm.publicationType} onChange={e => updateQuoteForm("publicationType", e.target.value)} style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none", appearance: "none", cursor: "pointer" }}>
                      <option value="" disabled>Select your publication type…</option>
                      <option>School Yearbook</option>
                      <option>Directory Design</option>
                      <option>Portrait Data Merge</option>
                      <option>Publication Cleanup</option>
                      <option>Annual Report</option>
                      <option>Other / Not Sure</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>Deadline</label>
                    <input type="text" value={quoteForm.deadline} placeholder="Example: May 15" onChange={e => updateQuoteForm("deadline", e.target.value)} style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = PALETTE.accent} onBlur={e => e.target.style.borderColor = "rgba(170,125,72,0.24)"} />
                  </div>
                </div>
                <div style={{ marginTop: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>Upload Files</label>
                  <input ref={fileInputRef} type="file" style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none" }} />
                </div>
                <div style={{ marginTop: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accentSoft, marginBottom: "0.45rem" }}>Project Details</label>
                  <textarea value={quoteForm.projectDetails} onChange={e => updateQuoteForm("projectDetails", e.target.value)} placeholder="Tell us what you have, what you need, and what would help us understand the publication…" rows={5} style={{ width: "100%", padding: "0.75rem 1rem", border: `1px solid ${PALETTE.border}`, background: "#ffffff", color: PALETTE.base, fontSize: "0.92rem", fontFamily: FONT_STACK, outline: "none", resize: "vertical", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = PALETTE.accent} onBlur={e => e.target.style.borderColor = "rgba(170,125,72,0.24)"} />
                </div>
                <div style={{ marginTop: "1.8rem" }}>
                  {formError && (
                    <div style={{ color: PALETTE.white, fontSize: "0.92rem", fontStyle: "italic", textAlign: "center", marginBottom: "1rem" }}>
                      {formError}
                    </div>
                  )}
                  <button className="btn-primary-hover" style={{ ...S.btnPrimary, width: "100%", padding: "1rem", fontSize: "0.82rem", textAlign: "center", opacity: formSubmitting ? 0.72 : 1 }} onClick={sendQuoteRequest} disabled={formSubmitting}>
                    {formSubmitting ? "Sending..." : "Send Quote Request →"}
                  </button>
                </div>
              </div>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#010611", padding: `2.5rem ${PAGE_X}`, borderTop: `1px solid ${PALETTE.border}` }}>
        <div className="footer-inner" style={{ ...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.4rem", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <img src={pressmarkLogo} alt="Pressmark Studio" style={{ ...S.logoImage, width: "clamp(160px, 20vw, 220px)", marginBottom: "0.6rem" }} />
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", lineHeight: 1.5, textAlign: "center" }}>
              Publication Design • Data Merge • Directory Design • Publication Rescue<br />Serving Schools, Teams & Organizations
            </div>
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
            {NAV_LINKS.map(l => (
              <button key={l.label} onClick={() => scrollTo(l.href)} style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = PALETTE.accent} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.45)"}>
                {l.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            © 2026 Pressmark Studio. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
