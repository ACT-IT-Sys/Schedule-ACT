/**
 * Schedule ACT — Controller & UI Renderer
 *
 * @format
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
    theme: CONFIG.THEME.default,
  };
  const $ = (id) => document.getElementById(id);
  const esc = (val) =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const pin = '<svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>';

  function monthLabel(monthIndex) {
    const m = Number(monthIndex);
    const pad = (n) => String(n).padStart(2, "0");
    const tok = { MM: pad(m), MMM: CONFIG.MONTH_SHORT[m], MMMM: CONFIG.MONTH_LABELS[m] };
    return tok[CONFIG.MONTH_DISPLAY] || CONFIG.MONTH_SHORT[m];
  }

  function parseDate(dateStr) {
    if (!dateStr || dateStr === "-" || dateStr.toLowerCase() === "n/a")
      return null;
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(iso[1], iso[2] - 1, iso[3]);
    const p = dateStr.split(/[\/\-.]/);
    return p.length >= 3
      ? new Date(p[2] < 100 ? +p[2] + 2000 : p[2], p[1] - 1, p[0])
      : null;
  }

  function formatDate(dateStr, pattern) {
    const d = parseDate(dateStr);
    if (!d) return dateStr || CONFIG.MISSING_DATE;
    const m = d.getMonth() + 1,
      pad = (n) => String(n).padStart(2, "0");
    const tok = {
      YYYY: d.getFullYear(),
      YY: pad(d.getFullYear() % 100),
      MMMM: CONFIG.MONTH_LABELS[m],
      MMM: CONFIG.MONTH_SHORT[m],
      MM: pad(m),
      DD: pad(d.getDate()),
      D: d.getDate(),
    };
    return (pattern || CONFIG.DATE_DISPLAY).replace(
      /YYYY|YY|MMMM|MMM|MM|DD|D/g,
      (t) => tok[t],
    );
  }

  function calcDays(etd, eta) {
    const d1 = parseDate(etd),
      d2 = parseDate(eta);
    return d1 && d2 ? Math.max(0, Math.round((d2 - d1) / 864e5)) : 0;
  }

  function normalizeRow(rawRow) {
    const row = {
      origin: CONFIG.EMPTY_TOKEN,
      destination: CONFIG.DEFAULTS.DESTINATION,
      vessel: CONFIG.EMPTY_TOKEN,
      voyage: CONFIG.EMPTY_TOKEN,
      etd: CONFIG.MISSING_DATE,
      eta: CONFIG.MISSING_DATE,
      cfsCutOff: CONFIG.MISSING_DATE,
      vgmHours: CONFIG.DEFAULTS.VGM_HOURS,
    };
    Object.entries(rawRow || {}).forEach(([k, v]) => {
      const cleanKey = k.trim().toLowerCase(),
        val = v == null ? "" : String(v).trim();
      Object.entries(CONFIG.COLUMN_ALIASES).forEach(([stdKey, aliases]) => {
        if (aliases.includes(cleanKey) && val) row[stdKey] = val;
      });
    });
    row.duration = calcDays(row.etd, row.eta);
    return row;
  }

  function fetchSchedules(monthIndex) {
    const tab = CONFIG.MONTH_TAB_MAP[String(monthIndex)] || String(monthIndex);
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&${tab.startsWith("gid=") ? tab : "sheet=" + encodeURIComponent(tab)}&_t=${Date.now()}`;
    return fetch(url)
      .then((r) => r.text())
      .then(
        (csv) =>
          new Promise((res, rej) => {
            if (!csv.trim() || csv.trim().startsWith("<"))
              return rej("Restricted/HTML");
            Papa.parse(csv, {
              header: true,
              skipEmptyLines: true,
              complete: (r) =>
                res(
                  r.data
                    .map(normalizeRow)
                    .filter((row) =>
                      CONFIG.SEARCH_FIELDS.some(
                        (k) => row[k] && row[k] !== CONFIG.EMPTY_TOKEN,
                      ),
                    ),
                ),
            });
          }),
      )
      .catch(() => []);
  }

  function renderUI() {
    let data = AppState.rawRows.filter(
      (r) =>
        !AppState.searchQuery ||
        CONFIG.SEARCH_FIELDS.some((k) =>
          (r[k] || "").toLowerCase().includes(AppState.searchQuery),
        ),
    );
    if (AppState.selectedCategory !== CONFIG.DEFAULTS.CATEGORY_FILTER)
      data = data.filter(
        (r) =>
          String(r[AppState.groupBy] || "").toLowerCase() ===
          AppState.selectedCategory.toLowerCase(),
      );
    if (AppState.sortDurationOrder !== "none")
      data.sort((a, b) =>
        AppState.sortDurationOrder === "asc"
          ? a.duration - b.duration
          : b.duration - a.duration,
      );

    window.ACT = { visible: data, parseDate, format: formatDate };
    $("itemCount").textContent = String(data.length);
    $("dataSourceTag").textContent = "Data: Live sheets";
    $("dataSourceTag").className = "source is-live";
    const all = CONFIG.DEFAULTS.CATEGORY_FILTER;
    const cats = [all, ...new Set(AppState.rawRows.map((r) => r[AppState.groupBy]).filter((v) => v && v !== CONFIG.EMPTY_TOKEN))].sort((a, b) => (a === all ? -1 : b === all ? 1 : a.localeCompare(b)));
    $("categoryPillContainer").innerHTML = cats.map((cat) => `<button type="button" class="pill" data-cat="${esc(cat)}" aria-pressed="${AppState.selectedCategory === cat}">${esc(cat)}</button>`).join("");

    $("cards").innerHTML = data.length
      ? data
          .map((item) => {
            const spec =
              CONFIG.CARD_LAYOUT[AppState.groupBy] || CONFIG.CARD_LAYOUT.origin;
            return `<article class="card">
                <div class="route-top">
                    <div><h2>${esc(item[AppState.groupBy])}</h2><div class="stem">${pin}<span>${esc(item[spec.stem])}</span></div></div>
                    ${spec.cols.map(([lbl, k]) => `<div><span class="k">${esc(lbl)}</span><span class="v">${esc(item[k])}</span></div>`).join("")}
                </div>
                <div class="route-line">
                    <div><span class="k">${esc(CONFIG.LABELS.DEPART)}</span><span class="v date depart">${esc(formatDate(item.etd))}</span></div>
                    <div class="mid"><span class="k">${esc(CONFIG.LABELS.ETA)}</span><span class="track"><span class="duration">${esc(item.duration)} ${esc(CONFIG.LABELS.DURATION_UNIT)}</span></span></div>
                    <div class="end"><span class="k">${esc(CONFIG.LABELS.ARRIVAL)}</span><span class="v date arrive">${esc(formatDate(item.eta))}</span></div>
                </div>
                <p class="card-foot">${esc(CONFIG.LABELS.VGM_BEFORE)} <b>${esc(item.vgmHours)}</b> ${esc(CONFIG.LABELS.VGM_HOURS)} <b>${esc(formatDate(item.cfsCutOff))}</b> ${esc(CONFIG.LABELS.CFS_AFTER)}</p>
            </article>`;
          })
          .join("")
      : `<div class="empty"><h3>${esc(CONFIG.LABELS.EMPTY)}</h3><p>${esc(CONFIG.LABELS.NO_DATA_MESSAGE)}</p></div>`;
  }

  function loadMonthData() {
    $("dataSourceTag").textContent = "Data: Fetching…";
    $("dataSourceTag").className = "source is-loading";
    $("cards").innerHTML =
      `<div class="skeleton"></div><div class="skeleton"></div><p class="loading">${esc(CONFIG.LABELS.LOADING)} schedules…</p>`;
    fetchSchedules(AppState.selectedMonth).then((rows) => {
      AppState.rawRows = rows;
      renderUI();
    });
  }

  function init() {
    $("appTitle").textContent = CONFIG.LABELS.APP_TITLE;
    Object.entries(CONFIG.MONTH_LABELS).forEach(([v]) =>
      $("monthPicker").add(new Option(monthLabel(v), v, false, +v === AppState.selectedMonth)),
    );
    CONFIG.GROUP_OPTIONS.forEach((o) =>
      $("groupBySelect").add(new Option(o.label, o.value)),
    );
    $("activeMonthBadge").textContent = monthLabel(AppState.selectedMonth);

    $("currentMonthToggle").addEventListener("click", () => {
      AppState.isCurrentMonth = !AppState.isCurrentMonth;
      $("currentMonthToggle").setAttribute(
        "aria-checked",
        String(AppState.isCurrentMonth),
      );
      $("monthPickerContainer").classList.toggle(
        "is-open",
        !AppState.isCurrentMonth,
      );
      AppState.selectedMonth = AppState.isCurrentMonth
        ? new Date().getMonth() + 1
        : +$("monthPicker").value;
      $("activeMonthBadge").textContent = monthLabel(AppState.selectedMonth);
      loadMonthData();
    });

    $("monthPicker").addEventListener("change", (e) => {
      AppState.selectedMonth = +e.target.value;
      $("activeMonthBadge").textContent = monthLabel(AppState.selectedMonth);
      loadMonthData();
    });
    $("groupBySelect").addEventListener("change", (e) => {
      AppState.groupBy = e.target.value;
      AppState.selectedCategory = CONFIG.DEFAULTS.CATEGORY_FILTER;
      renderUI();
    });
    $("categoryPillContainer").addEventListener("click", (e) => {
      const btn = e.target.closest(".pill");
      if (!btn) return;
      AppState.selectedCategory = btn.dataset.cat;
      renderUI();
    });
    $("searchInput").addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value.trim().toLowerCase();
      renderUI();
    });
    $("sortDurationBtn").addEventListener("click", () => {
      const cycle = CONFIG.SORT_CYCLE;
      const next = cycle[(cycle.findIndex((item) => item.id === AppState.sortDurationOrder) + 1) % cycle.length];
      AppState.sortDurationOrder = next.id;
      $("sortDurationLabel").textContent = next.label;
      renderUI();
    });
    $("resetBtn").addEventListener("click", () => {
      $("searchInput").value = "";
      AppState.searchQuery = "";
      AppState.selectedCategory = CONFIG.DEFAULTS.CATEGORY_FILTER;
      AppState.sortDurationOrder = CONFIG.DEFAULTS.SORT_DURATION;
      $("sortDurationLabel").textContent = CONFIG.SORT_CYCLE[0].label;
      renderUI();
    });
    $("themeToggle").addEventListener("click", () => {
      applyTheme(AppState.theme === "dark" ? "light" : "dark");
    });

    applyTheme(document.documentElement.getAttribute("data-theme") || CONFIG.THEME.default);
    loadMonthData();
  }

  function applyTheme(theme) {
    AppState.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", AppState.theme);
    const btn = $("themeToggle");
    const dark = AppState.theme === "dark";
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    try { localStorage.setItem(CONFIG.THEME.storageKey, AppState.theme); } catch (e) {}
  }
  window.addEventListener("DOMContentLoaded", init);
})();
