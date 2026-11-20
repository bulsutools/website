export type ToolStatus = "active" | "live";

export type ToolStat = {
  value: string;
  label: string;
};

export type ToolEntry = {
  id: string;
  name: string;
  description: string;
  href: string;
  githubHref?: string;
  actionLabel: string;
  status: ToolStatus;
  statusLabel: string;
  tags: string[];
  screenshot: string;
  screenshotAlt: string;
  /** Real, verified numbers only. Shown on the flagship card. */
  stats?: ToolStat[];
  /** Short trailing line for the flagship card. */
  note?: string;
};

export const tools: ToolEntry[] = [
  {
    id: "geary",
    name: "Geary",
    description:
      "The student-managed handbook for BulSU. Guides on enrollment, academics, documents, scholarships and campus organizations, each citing its official source.",
    href: "https://geary.bulsu.tools",
    githubHref: "https://github.com/bulsutools/geary",
    actionLabel: "Open Geary",
    status: "active",
    statusLabel: "Active",
    tags: ["Guide", "Open source"],
    screenshot: "/geary-screenshot.png",
    screenshotAlt: "Geary handbook homepage with student guides for BulSU",
  },
  {
    id: "gwa-calculator",
    name: "GWA Calculator",
    description:
      "Compute your General Weighted Average and estimate eligibility for the Gold Gear Awards and Latin Honors. Runs entirely in the browser; grades are never uploaded.",
    href: "https://gwa-calculator.bulsu.tools",
    githubHref: "https://github.com/bulsutools/gwa-calculator",
    actionLabel: "Open calculator",
    status: "active",
    statusLabel: "Active",
    tags: ["Academics", "Open source"],
    screenshot: "/gwa-calculator-screenshot.png",
    screenshotAlt:
      "GWA Calculator grade entry form with computed average and honors estimate",
  },
  {
    id: "room-tba",
    name: "Room TBA",
    description:
      "Find a building, college or room on the BulSU Malolos Campus 1 + Campus 2 map. Forked from the UPLB campus map.",
    href: "https://room-tba.bulsu.tools",
    githubHref: "https://github.com/bulsutools/room-tba",
    actionLabel: "Open the map",
    status: "active",
    statusLabel: "Active",
    tags: ["Map", "Open source"],
    screenshot: "/room-tba-screenshot.png",
    screenshotAlt:
      "Room TBA map of the BulSU Malolos campuses with building search",
  },
];
