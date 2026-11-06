/**
 * Card print — canvas, ratio, export, designs and background settings.
 * Load after CONFIG.js and before cardprint/index.js.
 *
 * @format
 */

const CP_CONFIG = {
  // Remember the last ratio / orientation / format between sessions (never the background).
  REMEMBER: true,
  STORAGE_KEY: "schedule-act-cardprint",

  // Used when nothing is remembered. Each id must exist in its list below.
  DEFAULTS: { ratio: "9:16", orientation: "landscape", format: "png" },

  // Logical px of the canvas short side. Export px = this x the format scale (360 x 3 = 1080).
  BASE: 360,

  // Ratios are written portrait (w < h). Landscape swaps them. 1:1 has no orientation.
  RATIOS: [
    { id: "1:1", label: "1:1", w: 1, h: 1 },
    { id: "3:4", label: "3:4", w: 3, h: 4 },
    { id: "9:16", label: "9:16", w: 9, h: 16 },
  ],
  ORIENTATIONS: [
    { id: "portrait", label: "Portrait" },
    { id: "landscape", label: "Landscape" },
  ],

  // kind: image | pdf | print.  scale: export multiplier.  quality: jpeg only.
  FORMATS: [
    {
      id: "png",
      label: "HD PNG",
      kind: "image",
      mime: "image/png",
      ext: "png",
      scale: 1.2,
    },
    {
      id: "jpeg",
      label: "JPEG",
      kind: "image",
      mime: "image/jpeg",
      ext: "jpeg",
      scale: 1,
      quality: 0.92,
    },
    {
      id: "pdf",
      label: "PDF",
      kind: "pdf",
      ext: "pdf",
      scale: 2,
      quality: 0.95,
    },
    { id: "print", label: "Print", kind: "print" },
  ],
  // Formats kept in the code but not offered in the dropdown. Empty the list to show them.
  HIDDEN: ["print", "pdf"],
  PDF_DPI: 96,
  EXPORT_BG: "#ffffffda",

  // Pause after the plate image decodes, before snapdom. Desktop/Android finish instantly.
  EXPORT_WAIT: { DECODE_MS: 400, RETRY: 1 },

  // Save options for image exports (PNG / JPEG). Option ids: download | share | ready.
  //   download: renders, then saves the file straight away.
  //   share:    renders, then shows a "Save image" button; its tap opens the share sheet (Photos, WhatsApp...).
  //   ready:    renders quietly after each change, so the tap itself opens the share sheet at once.
  // One option enabled: the Export button runs it directly. Two or more: it opens a menu.
  // Where the browser cannot share files, share / ready fall back to a normal download.
  SHARE: {
    OPTIONS: [
      { id: "download", label: "Download file", enabled: true },
      { id: "share", label: "Share / Save to Photos", enabled: true },
      { id: "ready", label: "Quick share", enabled: true },
    ],
    READY_LABEL: "Save image", // button shown by the "share" option once the image is ready
    PRERENDER_MS: 800, // quiet time after the last change before "ready" pre-renders
    REVOKE_MS: 60000, // how long a download link stays valid
  },

  // Shrink-to-fit: passes and safety margin when content overflows the canvas.
  FIT: { MAX_PASSES: 4, SAFETY: 0.98 },

  // Uploaded backgrounds are downscaled before use.
  UPLOAD: { MAX_SIDE: 1920, QUALITY: 0.9 },

  // Blur radius (px) used when baking a backdrop filter that does not state one.
  BAKE_BLUR: 8,

  // Raster engine for card export (snapdom preferred for glass fidelity).
  RASTER: "https://unpkg.com/@zumer/snapdom@latest/dist/snapdom.js",

  LABELS: {
    RATIO: "Ratio",
    ORIENTATION: "Orientation",
    FORMAT: "Export",
    FIT_HEIGHT: "Fit height",
    FIT_WIDTH: "Fit width",
  },

  // Short display labels for card fields. Stable against sheet header renames.
  // Fallback: CONFIG.LABELS[key] or the raw key.
  COLUMN_LABELS: {
    cfsCutOff: "CFS",
    etd: "ETD",
    eta: "ETA",
    vessel: "Vessel",
    voyage: "Voy",
    port: "Port",
    duration: "T/T",
    origin: "From",
    destination: "To",
  },

  // Moved from CONFIG.CARDPRINT
  ADDRESS: ["Jl. Perak Timur No. 248", "Tanjung Perak, Surabaya 60165"],
  SITE: "https://actglobal-freight.com",
  TITLE: "LCL IMPORT",
  bg: "", // global fallback; empty = no image (design paints its own)
  FIT_PAD: 16,
  DATE_PARTS: ["YYYY", "YY", "MMMM", "MMM", "MM", "DD", "D"],
  FONTS: [
    {
      DIR: "font",
      FAMILY: "Inter",
      FORMAT: "woff2",
      FILES: [
        { weight: 400, file: "Inter-Regular.woff2" },
        { weight: 500, file: "Inter-Medium.woff2" },
        { weight: 600, file: "Inter-SemiBold.woff2" },
        { weight: 700, file: "Inter-Bold.woff2" },
        { weight: 800, file: "Inter-ExtraBold.woff2" },
      ],
    },
    {
      DIR: "font",
      FAMILY: "JetBrains Mono",
      FORMAT: "woff2",
      FILES: [
        { weight: 500, file: "JetBrainsMono-Medium.woff2" },
        { weight: 700, file: "JetBrainsMono-Bold.woff2" },
      ],
    },
  ],
  PREV: "Previous design",
  NEXT: "Next design",
  DICE: "Random design",
  BG_LABEL: "Background",
  RESET_BG: "Reset background",
  OPEN: "Print card",
  CLOSE: "Close",
  DESIGNS: [
    // enabled: false hides a design from the switcher. Omit or true = shown.
    {
      id: "import-light",
      label: "Import glass",
      html: "cardprint/import-light/design.html",
      css: "cardprint/import-light/design.css",
      bg: "bg/AIO.webp",
      theme: "light",
      oCss: true, // loads cardprint/import-light/o.css after design.css
    },
    {
      id: "import-dark",
      label: "Import glass dark",
      html: "cardprint/import-dark/design.html",
      css: "cardprint/import-dark/design.css",
      bg: "bg/AIO.webp",
      theme: "dark",
      oCss: true, // loads cardprint/import-dark/o.css after design.css
    },
    {
      id: "import-a",
      label: "Import",
      html: "cardprint/import-a/design.html",
      css: "cardprint/import-a/design.css",
      bg: "bg/AIO.webp",
      enabled: false,
      oCss: true, // loads cardprint/import-a/o.css after design.css
    },
    {
      id: "modern-1",
      label: "Modern 1",
      html: "cardprint/modern-1/design.html",
      css: "cardprint/modern-1/design.css",
      bg: "bg/AIO.webp",
      oCss: true, // loads cardprint/modern-1/o.css after design.css
    },
  ],

  // Catalogue of selectable location backgrounds (relative to cardprint/).
  BACKGROUNDS: [
    { id: "aio", label: "AIO", file: "bg/AIO.webp" },
    { id: "shanghai", label: "Shanghai", file: "bg/shanghai.webp" },
    { id: "scanner", label: "Scanner", file: "bg/scanner.webp" },
  ],
};
