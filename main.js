/**
 * Schedule ACT — view + controller.
 * Depends on CONFIG (CONFIG.js) and Papa (PapaParse).
 */
(function () {
    const AppState = {
        isCurrentMonth: CONFIG.DEFAULTS.CURRENT_MONTH_ACTIVE,
        selectedMonth: new Date().getMonth() + 1,
        groupBy: CONFIG.DEFAULTS.GROUP_BY,
        searchQuery: "",
        selectedCategory: CONFIG.DEFAULTS.CATEGORY_FILTER,
        sortDurationOrder: CONFIG.DEFAULTS.SORT_DURATION,
        rawRows: [],
        processedRows: [],
        isMocking: false,
        theme: CONFIG.THEME.default
    };

    const $ = (id) => document.getElementById(id);

    function escapeHtml(value) {
        const amp = String.fromCharCode(38);
        return String(value ?? "")
            .replace(/&/g, amp + "amp;")
            .replace(/</g, amp + "lt;")
            .replace(/>/g, amp + "gt;")
            .replace(/"/g, amp + "quot;")
            .replace(/'/g, amp + "#39;");
    }

    function parseScheduleDate(dateStr) {
        if (!dateStr || typeof dateStr !== "string") return null;
        const clean = dateStr.trim();
        if (!clean || clean === "-" || clean.toLowerCase() === "n/a") return null;

        const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) {
            const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        const parts = clean.split(/[\/\-.]/);
        if (parts.length < 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        if (day < 1 || day > 31 || month < 0 || month > 11) return null;
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatScheduleDate(dateStr) {
        const date = parseScheduleDate(dateStr);
        if (!date) return dateStr || CONFIG.MISSING_DATE;
        const month = date.getMonth() + 1;
        const pad = (n) => String(n).padStart(2, "0");
        const tokens = {
            YYYY: String(date.getFullYear()),
            YY: pad(date.getFullYear() % 100),
            MMMM: CONFIG.MONTH_LABELS[month],
            MMM: CONFIG.MONTH_SHORT[month],
            MM: pad(month),
            DD: pad(date.getDate()),
            D: String(date.getDate())
        };
        return (CONFIG.DATE_DISPLAY || "D MMM").replace(/YYYY|YY|MMMM|MMM|MM|DD|D/g, (token) => tokens[token]);
    }

    function motionReduced() {
        const motion = CONFIG.MOTION || {};
        return motion.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function computeDurationDays(etdStr, etaStr) {
        const etd = parseScheduleDate(etdStr);
        const eta = parseScheduleDate(etaStr);
        if (!etd || !eta) return 0;
        const diff = eta.getTime() - etd.getTime();
        return Math.max(0, Math.round(diff / 86400000));
    }

    function normalizeRowKeys(rawRow) {
        const normalized = {
            origin: CONFIG.EMPTY_TOKEN,
            destination: CONFIG.EMPTY_TOKEN,
            vessel: CONFIG.EMPTY_TOKEN,
            voyage: CONFIG.EMPTY_TOKEN,
            etd: CONFIG.MISSING_DATE,
            eta: CONFIG.MISSING_DATE,
            cfsCutOff: CONFIG.MISSING_DATE,
            vgmHours: CONFIG.DEFAULTS.VGM_HOURS,
        };

        Object.entries(rawRow || {}).forEach(([key, val]) => {
            if (!key) return;
            const cleanKey = key.trim().toLowerCase();
            const stringVal = val == null ? "" : String(val).trim();
            Object.entries(CONFIG.COLUMN_ALIASES).forEach(([stdKey, aliases]) => {
                if (aliases.includes(cleanKey) && stringVal) normalized[stdKey] = stringVal;
            });
        });

        normalized.duration = computeDurationDays(normalized.etd, normalized.eta);
        if (!normalized.vgmHours || normalized.vgmHours === CONFIG.EMPTY_TOKEN) {
            normalized.vgmHours = String(CONFIG.DEFAULTS.VGM_HOURS);
        }
        return normalized;
    }

    function applyPlaceDefaults(row) {
        if (!row.destination || row.destination === CONFIG.EMPTY_TOKEN) {
            row.destination = CONFIG.DEFAULTS.DESTINATION;
        }
        return row;
    }

    function rowLooksEmpty(row) {
        return CONFIG.SEARCH_FIELDS.every((key) => !row[key] || row[key] === CONFIG.EMPTY_TOKEN);
    }

    function generateMockSchedules(monthIndex) {
        const ports = ["Jakarta", "Surabaya", "Port Klang", "Singapore", "Shanghai", "Yokohama", "Busan", "Hamburg"];
        const vessels = ["Ever Given", "ONE Apus", "MSC Isabella", "Maersk Mc-Kinney", "CMA CGM Antoine"];
        const voyages = ["V.2401E", "V.089W", "V.102N", "V.554S", "V.771E"];
        const monthStr = String(monthIndex).padStart(2, "0");
        const rows = [];

        for (let i = 1; i <= 9; i += 1) {
            const origin = ports[i % ports.length];
            let destination = ports[(i + 3) % ports.length];
            if (origin === destination) destination = "Rotterdam";
            const startDay = (i * 3) % 20 + 1;
            const duration = 5 + (i % 8);
            const endDay = Math.min(28, startDay + duration);
            const cfsDay = Math.max(1, startDay - 2);
            const pad = (n) => String(n).padStart(2, "0");
            const etd = `${pad(startDay)}/${monthStr}/2026`;
            const eta = `${pad(endDay)}/${monthStr}/2026`;
            const cfsCutOff = `${pad(cfsDay)}/${monthStr}/2026`;
            rows.push({
                origin,
                destination,
                vessel: vessels[i % vessels.length],
                voyage: voyages[i % voyages.length],
                etd,
                eta,
                cfsCutOff,
                duration: computeDurationDays(etd, eta)
            });
        }
        return rows;
    }

    function fallbackMock(monthIndex) {
        AppState.isMocking = true;
        return generateMockSchedules(monthIndex);
    }

    function fetchSheetData(monthIndex) {
    const tabTarget = CONFIG.MONTH_TAB_MAP[monthIndex] || String(monthIndex);
    
    // Determine whether to use gid=... or sheet=... parameter
    const queryParam = tabTarget.startsWith("gid=") 
        ? tabTarget 
        : `sheet=${encodeURIComponent(tabTarget)}`;

    const csvUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&${queryParam}&_t=${Date.now()}`;

    return fetch(csvUrl)
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then((csvText) => new Promise((resolve, reject) => {
            const trimmed = csvText.trim();
            // Detect if Google returned a login redirect HTML page instead of CSV
            if (!trimmed || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
                reject(new Error("Sheet is restricted or returned HTML login page. Ensure sharing is 'Anyone with link'."));
                return;
            }
            if (typeof Papa === "undefined") {
                reject(new Error("CSV parser unavailable"));
                return;
            }
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const parsed = (results.data || []).map(normalizeRowKeys).filter((row) => !rowLooksEmpty(row)).map(applyPlaceDefaults);
                    if (!parsed.length) {
                        reject(new Error("Empty schedule tab"));
                        return;
                    }
                    AppState.isMocking = false;
                    resolve(parsed);
                },
                error: (error) => reject(error)
            });
        }))
        .catch((err) => {
            console.error(`[Schedule ACT] Fetch failed for month ${monthIndex}:`, err);
            if (CONFIG.USE_MOCK_FALLBACK) {
                return fallbackMock(monthIndex);
            }
            // Return empty array and let the UI display the clear "No data" message
            AppState.isMocking = false;
            return [];
        });
}

    function getCardLayout(item, groupBy) {
        const spec = CONFIG.CARD_LAYOUT[groupBy] || CONFIG.CARD_LAYOUT.origin;
        const pair = ([label, key]) => ({ label, value: item[key] });
        return {
            title: item[groupBy] || CONFIG.EMPTY_TOKEN,
            stem: item[spec.stem] || CONFIG.EMPTY_TOKEN,
            cols: spec.cols.map(pair),
            etd: item.etd,
            eta: item.eta,
            cfsCutOff: item.cfsCutOff,
            vgmHours: item.vgmHours || CONFIG.DEFAULTS.VGM_HOURS,
            duration: item.duration
        };
    }

    function filterAndSortData() {
        let data = AppState.rawRows.slice();
        const query = AppState.searchQuery.toLowerCase();
        if (query) {
            data = data.filter((row) => CONFIG.SEARCH_FIELDS.some((key) => (
                row[key] && row[key].toLowerCase().includes(query)
            )));
        }
        if (AppState.selectedCategory !== CONFIG.DEFAULTS.CATEGORY_FILTER) {
            data = data.filter((row) => String(row[AppState.groupBy] || "").toLowerCase() === AppState.selectedCategory.toLowerCase());
        }
        if (AppState.sortDurationOrder === "asc") data.sort((a, b) => a.duration - b.duration);
        if (AppState.sortDurationOrder === "desc") data.sort((a, b) => b.duration - a.duration);
        AppState.processedRows = data;
    }

    function renderCategoryPills() {
        const container = $("categoryPillContainer");
        const unique = Array.from(new Set(AppState.rawRows.map((row) => row[AppState.groupBy]).filter(Boolean))).sort();
        container.innerHTML = "";
        [CONFIG.DEFAULTS.CATEGORY_FILTER, ...unique].forEach((cat) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pill";
            btn.textContent = cat;
            btn.setAttribute("aria-pressed", String(AppState.selectedCategory === cat));
            btn.addEventListener("click", () => {
                AppState.selectedCategory = cat;
                renderUI();
            });
            container.appendChild(btn);
        });
    }

    function renderCards() {
        const grid = $("cards");
        const count = $("itemCount");
        grid.innerHTML = "";
        count.textContent = String(AppState.processedRows.length);
        $("liveStatus").textContent = `${AppState.processedRows.length} schedules shown`;

        if (!AppState.processedRows.length) {
            grid.innerHTML = `
                <div class="empty">
                    <h3>${escapeHtml(CONFIG.LABELS.EMPTY)}</h3>
                    <p>${escapeHtml(CONFIG.LABELS.NO_DATA_MESSAGE)} ${escapeHtml(CONFIG.LABELS.EMPTY_HINT)}</p>
                </div>`;
            return;
        }

        AppState.processedRows.forEach((item) => {
            const layout = getCardLayout(item, AppState.groupBy);
            const card = document.createElement("article");
            card.className = "card";
            card.innerHTML = `
                <div class="route-top">
                    <div>
                        <h2>${escapeHtml(layout.title)}</h2>
                        <div class="stem"><i></i><span>${escapeHtml(layout.stem)}</span></div>
                    </div>
                    ${layout.cols.map((col) => `
                        <div>
                            <span class="k">${escapeHtml(col.label)}</span>
                            <span class="v">${escapeHtml(col.value)}</span>
                        </div>`).join("")}
                </div>
                <div class="route-line">
                    <div>
                        <span class="k">${escapeHtml(CONFIG.LABELS.DEPART)}</span>
                        <span class="v date depart">${escapeHtml(formatScheduleDate(layout.etd))}</span>
                    </div>
                    <div class="mid">
                        <span class="k">${escapeHtml(CONFIG.LABELS.ETA)}</span>
                        <span class="duration">${escapeHtml(layout.duration)} ${escapeHtml(CONFIG.LABELS.DURATION_UNIT)}</span>
                    </div>
                    <div class="end">
                        <span class="k">${escapeHtml(CONFIG.LABELS.ARRIVAL)}</span>
                        <span class="v date arrive">${escapeHtml(formatScheduleDate(layout.eta))}</span>
                    </div>
                </div>
                <p class="card-foot">
                    ${escapeHtml(CONFIG.LABELS.VGM_BEFORE)}
                    <b>${escapeHtml(layout.vgmHours)}</b>
                    ${escapeHtml(CONFIG.LABELS.VGM_HOURS)}
                    <b>${escapeHtml(formatScheduleDate(layout.cfsCutOff))}</b>
                    ${escapeHtml(CONFIG.LABELS.CFS_AFTER)}
                </p>`;
            grid.appendChild(card);
        });
    }

    function updateDataBadge() {
        const badge = $("dataSourceTag");
        if (AppState.isMocking) {
            badge.textContent = "Data: Demo fallback";
            badge.className = "source is-demo";
        } else {
            badge.textContent = "Data: Live sheets";
            badge.className = "source is-live";
        }
    }

    function renderUI() {
        filterAndSortData();
        renderCategoryPills();
        renderCards();
        updateDataBadge();
    }

    function showLoading() {
        $("cards").innerHTML = `
            <div class="skeleton" aria-hidden="true"></div>
            <div class="skeleton" aria-hidden="true"></div>
            <div class="skeleton" aria-hidden="true"></div>
            <p class="loading">${escapeHtml(CONFIG.LABELS.LOADING)} ${escapeHtml(CONFIG.MONTH_LABELS[AppState.selectedMonth] || "month")} schedules…</p>`;
        $("liveStatus").textContent = "Loading schedules";
    }

    function loadActiveMonthData() {
        showLoading();
        return fetchSheetData(AppState.selectedMonth).then((rows) => {
            AppState.rawRows = rows;
            AppState.selectedCategory = CONFIG.DEFAULTS.CATEGORY_FILTER;
            renderUI();
        });
    }

    function monthBadgeText() {
        const name = CONFIG.MONTH_LABELS[AppState.selectedMonth] || "Month";
        return `${name.slice(0, 3)} (${AppState.selectedMonth})`;
    }

    function applyTheme(theme) {
        AppState.theme = theme === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", AppState.theme);
        const toggle = $("themeToggle");
        const isDark = AppState.theme === "dark";
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
        try { localStorage.setItem(CONFIG.THEME.storageKey, AppState.theme); } catch (e) { /* ignore */ }
    }

    function startTypewriter(input) {
        const cfg = CONFIG.TYPEWRITER || {};
        const phrases = (cfg.phrases && cfg.phrases.length) ? cfg.phrases : [CONFIG.LABELS.SEARCH_PLACEHOLDER];
        const typeOn = (CONFIG.MOTION || {}).typewriter !== false && cfg.enabled !== false;
        if (!typeOn || motionReduced()) {
            input.placeholder = phrases[0];
            return;
        }

        let phraseIndex = 0;
        let charIndex = 0;
        let deleting = false;
        const typeMs = cfg.typeSpeedMs || cfg.typeMs || 70;
        const deleteMs = cfg.deleteSpeedMs || cfg.deleteMs || 36;
        const holdMs = cfg.delayBeforeDeleteMs || cfg.pauseMs || 1200;

        const tick = () => {
            if (document.activeElement === input || input.value) {
                input.placeholder = CONFIG.LABELS.SEARCH_PLACEHOLDER;
                window.setTimeout(tick, 400);
                return;
            }
            const phrase = phrases[phraseIndex];
            if (!deleting) {
                charIndex += 1;
                input.placeholder = phrase.slice(0, charIndex);
                if (charIndex >= phrase.length) {
                    deleting = true;
                    window.setTimeout(tick, holdMs);
                    return;
                }
                window.setTimeout(tick, typeMs);
                return;
            }
            charIndex -= 1;
            input.placeholder = phrase.slice(0, Math.max(charIndex, 0));
            if (charIndex <= 0) {
                deleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                window.setTimeout(tick, Math.round(holdMs / 2));
                return;
            }
            window.setTimeout(tick, deleteMs);
        };

        window.setTimeout(tick, cfg.startDelayMs || 300);
    }

    function setupEventListeners() {
        const monthPickerContainer = $("monthPickerContainer");
        const monthPicker = $("monthPicker");
        const currentMonthToggle = $("currentMonthToggle");
        const groupBySelect = $("groupBySelect");
        const searchInput = $("searchInput");
        const clearSearchBtn = $("clearSearchBtn");
        const sortDurationBtn = $("sortDurationBtn");
        const sortDurationLabel = $("sortDurationLabel");

        Object.entries(CONFIG.MONTH_LABELS).forEach(([val, label]) => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = `${val} = ${label}`;
            if (Number(val) === AppState.selectedMonth) opt.selected = true;
            monthPicker.appendChild(opt);
        });

        CONFIG.GROUP_OPTIONS.forEach((item) => {
            const node = document.createElement("option");
            node.value = item.value;
            node.textContent = item.label;
            groupBySelect.appendChild(node);
        });
        groupBySelect.value = AppState.groupBy;
        $("activeMonthBadge").textContent = monthBadgeText();
        if (!AppState.isCurrentMonth) monthPickerContainer.classList.add("is-open");

        currentMonthToggle.addEventListener("click", () => {
            AppState.isCurrentMonth = !AppState.isCurrentMonth;
            currentMonthToggle.setAttribute("aria-checked", String(AppState.isCurrentMonth));
            if (AppState.isCurrentMonth) {
                monthPickerContainer.classList.remove("is-open");
                AppState.selectedMonth = new Date().getMonth() + 1;
            } else {
                monthPickerContainer.classList.add("is-open");
                AppState.selectedMonth = parseInt(monthPicker.value, 10);
            }
            monthPicker.value = String(AppState.selectedMonth);
            $("activeMonthBadge").textContent = monthBadgeText();
            loadActiveMonthData();
        });

        monthPicker.addEventListener("change", (event) => {
            AppState.selectedMonth = parseInt(event.target.value, 10);
            $("activeMonthBadge").textContent = monthBadgeText();
            loadActiveMonthData();
        });

        groupBySelect.addEventListener("change", (event) => {
            AppState.groupBy = event.target.value;
            AppState.selectedCategory = CONFIG.DEFAULTS.CATEGORY_FILTER;
            renderUI();
        });

        let searchTimeout;
        searchInput.addEventListener("input", (event) => {
            const value = event.target.value;
            clearSearchBtn.hidden = !value;
            window.clearTimeout(searchTimeout);
            searchTimeout = window.setTimeout(() => {
                AppState.searchQuery = value.trim();
                renderUI();
            }, 150);
        });

        clearSearchBtn.addEventListener("click", () => {
            searchInput.value = "";
            clearSearchBtn.hidden = true;
            AppState.searchQuery = "";
            searchInput.focus();
            renderUI();
        });

        sortDurationBtn.addEventListener("click", () => {
            const cycle = CONFIG.SORT_CYCLE;
            const index = cycle.findIndex((item) => item.id === AppState.sortDurationOrder);
            const next = cycle[(index + 1) % cycle.length];
            AppState.sortDurationOrder = next.id;
            sortDurationLabel.textContent = next.label;
            renderUI();
        });

        $("resetBtn").addEventListener("click", () => {
            AppState.searchQuery = "";
            AppState.selectedCategory = CONFIG.DEFAULTS.CATEGORY_FILTER;
            AppState.sortDurationOrder = CONFIG.DEFAULTS.SORT_DURATION;
            AppState.groupBy = CONFIG.DEFAULTS.GROUP_BY;
            searchInput.value = "";
            clearSearchBtn.hidden = true;
            groupBySelect.value = AppState.groupBy;
            sortDurationLabel.textContent = CONFIG.SORT_CYCLE[0].label;
            renderUI();
        });

        $("themeToggle").addEventListener("click", () => {
            applyTheme(AppState.theme === "dark" ? "light" : "dark");
        });

        startTypewriter(searchInput);
    }

    window.addEventListener("DOMContentLoaded", () => {
        if (motionReduced()) document.documentElement.classList.add("reduce-motion");
        const themeKey = document.querySelector('meta[name="theme-storage-key"]');
        if (themeKey) CONFIG.THEME.storageKey = themeKey.content;
        $("appTitle").textContent = CONFIG.LABELS.APP_TITLE;
        $("currentMonthLabel").textContent = CONFIG.LABELS.CURRENT_MONTH;
        $("appTagline").textContent = CONFIG.LABELS.TAGLINE;
        document.title = CONFIG.LABELS.APP_TITLE;
        applyTheme(document.documentElement.getAttribute("data-theme") || CONFIG.THEME.default);
        setupEventListeners();
        loadActiveMonthData();
    });
}());
