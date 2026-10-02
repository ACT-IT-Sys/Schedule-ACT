/**
 * Schedule ACT — centralized configuration.
 * Edit this file only to retarget sheets, labels, aliases, defaults, and the search typewriter.
 */
const CONFIG = {
    SHEET_ID: "14F52VtApPb1gbIkpif4JjikqCiWYAHyKwHxmew7Ct2s",
    USE_MOCK_FALLBACK: false,
	
	
    MONTH_TAB_MAP: {
        1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6",
        7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12"
    },
	

	/*
	MONTH_TAB_MAP: {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December"
},
*/

    MONTH_LABELS: {
        1: "January", 2: "February", 3: "March", 4: "April",
        5: "May", 6: "June", 7: "July", 8: "August",
        9: "September", 10: "October", 11: "November", 12: "December"
    },

    MONTH_SHORT: {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
        7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
    },

    COLUMN_ALIASES: {
        origin: ["origin", "from", "pol", "port of loading"],
        destination: ["destination", "to", "pod", "port of discharge"],
        vessel: ["vessel", "vessel name", "ship"],
        voyage: ["voyage", "voyage no", "voy", "vno"],
        etd: ["etd", "depart", "departure", "etd date"],
        eta: ["eta", "arrival", "arrive", "eta date"],
        cfsCutOff: ["cfs cut off", "cfs cutoff", "cfs_cutoff", "cfs"]
    },

    DEFAULTS: {
        GROUP_BY: "origin",
        CURRENT_MONTH_ACTIVE: true,
        CATEGORY_FILTER: "ALL",
        SORT_DURATION: "none",
        THEME: "light"
    },

    DATE_FORMAT: "DD/MM/YYYY",
    DATE_DISPLAY: "D MMM",

    LABELS: {
        APP_TITLE: "Schedule ACT",
        TAGLINE: "Vessel & voyage logistics",
        NO_DATA_MESSAGE: "No schedule data available for the selected month.",
        SEARCH_PLACEHOLDER: "Search origin, vessel, voyage, destination…",
        DURATION_UNIT: "days",
        CFS_HELP: "CFS cut-off is the last time cargo must be received at the container freight station before departure.",
        CURRENT_MONTH: "Current month",
        EMPTY: "No schedules found",
        EMPTY_HINT: "Try another month, category, or search.",
        LOADING: "Fetching",
        DEPART: "Depart",
        ARRIVAL: "Arrival"
    },

    SEARCH_FIELDS: ["origin", "vessel", "voyage", "destination"],
    EMPTY_TOKEN: "N/A",
    MISSING_DATE: "—",

    GROUP_OPTIONS: [
        { value: "origin", label: "Group by origin" },
        { value: "vessel", label: "Group by vessel" },
        { value: "voyage", label: "Group by voyage" },
        { value: "destination", label: "Group by destination" }
    ],

    SORT_CYCLE: [
        { id: "none", label: "Duration: Default" },
        { id: "asc", label: "Duration: Shortest" },
        { id: "desc", label: "Duration: Longest" }
    ],

    CARD_LAYOUT: {
        origin: { sub1: ["Vessel", "vessel"], sub2: ["Voyage", "voyage"], foot: ["Dest", "destination"] },
        vessel: { sub1: ["Origin", "origin"], sub2: ["Voyage", "voyage"], foot: ["Dest", "destination"] },
        voyage: { sub1: ["Vessel", "vessel"], sub2: ["Origin", "origin"], foot: ["Dest", "destination"] },
        destination: { sub1: ["Origin", "origin"], sub2: ["Vessel", "vessel"], foot: ["Voyage", "voyage"] }
    },

    /**
     * typewriter: placeholder animation. reduceMotion: force static motion off.
     * prefers-reduced-motion still wins when the OS asks for it.
     * DATE_DISPLAY tokens: D DD MM MMM MMMM YY YYYY. Anything else is literal.
     * Timings are milliseconds.
     */
    MOTION: {
        typewriter: true,
        reduceMotion: false
    },

    TYPEWRITER: {
        phrases: [
            "Search origin…",
            "Search vessel…",
            "Search voyage…",
            "Search destination…"
        ],
        typeSpeedMs: 68,
        deleteSpeedMs: 34,
        delayBeforeDeleteMs: 1300,
        startDelayMs: 420
    },

    THEME: {
        storageKey: "schedule-act-theme",
        default: "light"
    }
};
