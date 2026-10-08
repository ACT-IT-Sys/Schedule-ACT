/**
 * Schedule ACT — Centralized Configuration.
 *
 * @format
 */

const CONFIG = {
  SHEET_ID: "14F52VtApPb1gbIkpif4JjikqCiWYAHyKwHxmew7Ct2s",
  USE_MOCK_FALLBACK: false,

  MONTH_TAB_MAP: Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, String(i + 1)]),
  ),

  MONTH_LABELS: {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
  },

  MONTH_SHORT: {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
  },

  COLUMN_ALIASES: {
    origin: ["origin", "from", "pol", "port of loading"],
    destination: ["destination", "to", "pod", "port of discharge"],
    vessel: ["vessel", "vessel name", "ship"],
    voyage: ["voyage", "voyage no", "voy", "vno"],
    etd: ["etd", "depart", "departure", "etd date"],
    eta: ["eta", "arrival", "arrive", "eta date"],
    cfsCutOff: ["cfs cut off", "cfs cutoff", "cfs_cutoff", "cfs"],
    vgmHours: ["vgm", "vgm hours", "vgm cut off", "vgm cutoff"],
  },

  DEFAULTS: {
    GROUP_BY: "origin",
    CURRENT_MONTH_ACTIVE: true,
    CATEGORY_FILTER: "ALL",
    SORT_DURATION: "none",
    THEME: "light",
    DESTINATION: "Surabaya",
    VGM_HOURS: "4",
  },

  DATE_FORMAT: "DD/MM/YYYY",
  DATE_DISPLAY: "D MMM",
  MONTH_DISPLAY: "MMM",

  LABELS: {
    APP_TITLE: "Schedule ACT",
    TAGLINE: "Vessel & voyage logistics",
    NO_DATA_MESSAGE: "No schedule data available for the selected month.",
    SEARCH_PLACEHOLDER: "Search origin, vessel, voyage, destination…",
    DURATION_UNIT: "days",
    CFS_HELP:
      "CFS cut-off is the last time cargo must be received at the container freight station before departure.",
    CURRENT_MONTH: "Current month",
    EMPTY: "No schedules found",
    EMPTY_HINT: "Try another month, category, or search.",
    LOADING: "Fetching",
    DEPART: "Depart",
    ARRIVAL: "Arrival",
    ETA: "ETA",
    VGM_BEFORE: "VGM cut-off",
    VGM_HOURS: "hours before",
    CFS_AFTER: "CFS cut-off",
  },

  SEARCH_FIELDS: ["origin", "vessel", "voyage", "destination"],
  EMPTY_TOKEN: "N/A",
  MISSING_DATE: "—",

  GROUP_OPTIONS: [
    { value: "origin", label: "Group by origin" },
    { value: "vessel", label: "Group by vessel" },
    { value: "voyage", label: "Group by voyage" },
    { value: "destination", label: "Group by destination" },
  ],

  SORT_CYCLE: [
    { id: "none", label: "➖" },
    { id: "asc", label: "🔽" },
    { id: "desc", label: "🔼" },
  ],

  CARD_LAYOUT: {
    origin: {
      stem: "destination",
      cols: [
        ["Vessel", "vessel"],
        ["Voyage", "voyage"],
      ],
    },
    destination: {
      stem: "origin",
      cols: [
        ["Vessel", "vessel"],
        ["Voyage", "voyage"],
      ],
    },
    vessel: {
      stem: "destination",
      cols: [
        ["Origin", "origin"],
        ["Voyage", "voyage"],
      ],
    },
    voyage: {
      stem: "destination",
      cols: [
        ["Vessel", "vessel"],
        ["Origin", "origin"],
      ],
    },
  },

  MOTION: { typewriter: true, reduceMotion: false },

  TYPEWRITER: {
    phrases: [
      "Search origin…",
      "Search vessel…",
      "Search voyage…",
      "Search destination…",
    ],
    typeSpeedMs: 68,
    deleteSpeedMs: 34,
    delayBeforeDeleteMs: 1300,
    startDelayMs: 420,
  },

  THEME: { storageKey: "schedule-act-theme", default: "light" },

  BULK: {
    HEADER: "img/bulk-header.webp",
    CSS: "bulk.css",
    BTN_ID: "bulkBtn",
    WINDOW: "bulk",
    KEY_SEP: "\0",
    JOIN: " - ",
    SINGLE_IMAGE: 1,
    PAGE_CAP: 3,
    PAGE_PX: 1200, //1123
    RASTER:
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    PDF: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    AS: [
      ["pdf", "Interactive PDF"],
      ["print", "Print PDF"],
      ["jpeg", "JPEG"],
    ],
    LAYOUTS: [
      ["single", "Single column"],
      ["compact", "Compact"],
    ],
    AS_DEFAULT: "pdf",
    LAYOUT_DEFAULT: "single",
    TITLE: "LCL import consol schedules",
    TITLE_PROMPT: "Schedule title",
    PRINT_AS: "Print as",
    FORMAT: "Format",
    EXECUTE: "Execute",
    POPUP: "Allow popups to print the bulk sheet.",
    BODY_BG: "#ffffff",
    TBN: "T.B.N.",
    VGM: "VGM cut-off:",
    ORIGIN_ORDER: [
      "Taiwan",
      "Busan",
      "Hong Kong",
      "Hongkong",
      "Shanghai",
      "Bangkok",
    ],
    DATE_OF: { etd: "DD MMM", eta: "DD MMM", cfsCutOff: "DD MMM" },
    ORDER: [
      { key: "vessel", label: "VESSEL" },
      { key: "voyage", label: "VOYAGE" },
      { key: "cfsCutOff", label: "CFS cut-off" },
      { key: "etd", label: "Depart" },
      { key: "duration", label: "ETA" },
      { key: "eta", label: "Arrival" },
    ],
    ID_PLACES: [
      "indonesia",
      "surabaya",
      "tanjung perak",
      "jakarta",
      "tanjung priok",
      "semarang",
      "belawan",
      "medan",
      "makassar",
      "balikpapan",
    ],
    ORIGIN_COLORS: {
      taiwan: { bg: "#d6ebf5", ink: "#1e4d6b" },
      busan: { bg: "#d9e2f5", ink: "#2c3e6b" },
      "hong kong": { bg: "#d9f0e3", ink: "#1e5c40" },
      hongkong: { bg: "#d9f0e3", ink: "#1e5c40" },
      shanghai: { bg: "#e6e0f5", ink: "#3d3270" },
      bangkok: { bg: "#f8ecd4", ink: "#6b4e16" },
    },
    PALETTE: [
      { bg: "#d6ebf5", ink: "#1e4d6b" },
      { bg: "#d9e2f5", ink: "#2c3e6b" },
      { bg: "#d9f0e3", ink: "#1e5c40" },
      { bg: "#e6e0f5", ink: "#3d3270" },
      { bg: "#f8ecd4", ink: "#6b4e16" },
      { bg: "#d5f0ee", ink: "#1a5552" },
      { bg: "#f6e0e8", ink: "#6b3048" },
      { bg: "#e4e8ee", ink: "#334155" },
    ],
  },

  CP: {
    TAB: "CP",
    EMPTY: "—",
    SEP: " | ",
    FIELDS: ["name", "mobile", "email"],
    TEL: "tel:",
    MAIL: "mailto:",
    PLATFORMS: [{ key: "wa", icon: "img/wa.webp" }],
  },
};
