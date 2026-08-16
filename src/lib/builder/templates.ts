import type { BuildMode } from "./prompt";

export interface Template {
  id: string;
  name: string;
  blurb: string;
  mode: BuildMode;
  prompt: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "saas",
    name: "SaaS landing",
    blurb: "Hero, features, pricing, FAQ",
    mode: "static",
    prompt:
      "A landing page for a SaaS product that turns customer calls into CRM notes. Hero with product mockup, logo strip, three feature blocks, interactive pricing toggle, testimonials, FAQ accordion, footer. Confident dark UI with a sharp accent colour.",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    blurb: "Personal site with case studies",
    mode: "static",
    prompt:
      "A portfolio site for a product designer. Oversized editorial typography, work grid with hover reveals, an about page and a contact page with a working form UI.",
  },
  {
    id: "restaurant",
    name: "Restaurant",
    blurb: "Menu, story, reservations",
    mode: "static",
    prompt:
      "A warm restaurant website: hero with food photography, menu with categories and prices, our story, gallery, reservation form, opening hours and map placeholder.",
  },
  {
    id: "shop",
    name: "Storefront",
    blurb: "Products, cart, checkout UI",
    mode: "react",
    prompt:
      "A small e-commerce storefront with a product grid, product detail modal, working cart with quantities and totals stored in state, and a checkout summary screen.",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    blurb: "Charts, tables, filters",
    mode: "react",
    prompt:
      "An analytics dashboard with sidebar nav, KPI cards, a hand-rolled SVG line chart and bar chart, a sortable/filterable data table, and a dark/light toggle.",
  },
  {
    id: "game",
    name: "Game",
    blurb: "Playable canvas game",
    mode: "single",
    prompt:
      "A polished arcade game in one HTML file: canvas rendering, keyboard and touch controls, score, levels, particle effects, pause and restart, high score in localStorage.",
  },
  {
    id: "blog",
    name: "Blog",
    blurb: "Index plus article pages",
    mode: "static",
    prompt:
      "A minimal blog: index with featured post and post list, three full article pages with real written content, an about page, tag chips and reading time.",
  },
  {
    id: "tool",
    name: "Micro tool",
    blurb: "Single-purpose utility",
    mode: "single",
    prompt:
      "A single-page utility tool with a clean UI, instant results, keyboard shortcuts, copy-to-clipboard and localStorage history. Pick something genuinely useful.",
  },
  {
    id: "docs",
    name: "Docs site",
    blurb: "Sidebar, search, code blocks",
    mode: "static",
    prompt:
      "A documentation site with sticky sidebar navigation, on-page table of contents, syntax-highlighted code blocks, copy buttons and client-side search.",
  },
];
