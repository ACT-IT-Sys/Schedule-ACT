/**
 * Bulk sheet. Refactored for clean modularity, DRY compliance, and performance optimizations.
 *
 * @format
 */

(function () {
  const B = () => CONFIG.BULK,
    L = () => CONFIG.LABELS;
  const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

  // Core Utilities & Helpers
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ENT[c]);
  const parseSafeDate = (v) => ACT.parseDate(v) || 0;
  const normalizeStr = (s) => String(s ?? "").toLowerCase();

  const tint = (o) => {
    const bulk = B(),
      key = normalizeStr(o);
    if (bulk.ORIGIN_COLORS[key]) return bulk.ORIGIN_COLORS[key];
    const hash = [...o].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return bulk.PALETTE[hash % bulk.PALETTE.length];
  };

  const value = (r, k) => {
    const bulk = B();
    if (k === "vessel" && r.vessel === CONFIG.EMPTY_TOKEN) return bulk.TBN;
    if (k === "duration") return `${r.duration} ${L().DURATION_UNIT}`;
    return bulk.DATE_OF[k]
      ? ACT.parseDate(r[k])
        ? ACT.format(r[k], bulk.DATE_OF[k])
        : CONFIG.MISSING_DATE
      : r[k];
  };

  const tr = (tag, items, attr = "") =>
    `<tr${attr}>${items.map((x) => `<${tag}>${esc(x)}</${tag}>`).join("")}</tr>`;

  // Data Transformation & Aggregation Layer
  const group = (rows) =>
    rows
      .filter((r) =>
        B().ID_PLACES.some((p) => normalizeStr(r.destination).includes(p)),
      )
      .reduce((m, r) => {
        const k = [r.origin, r.destination].join(B().KEY_SEP);
        return m.set(k, [...(m.get(k) || []), r]);
      }, new Map());

  // Render Engine Components
  const section = ([key, list]) => {
    const bulk = B(),
      [origin, dest] = key.split(bulk.KEY_SEP),
      c = tint(origin),
      cols = bulk.ORDER;
    const paint = `background:${c.bg};color:${c.ink}`;

    const byEtd = (a, b) =>
      parseSafeDate(a.etd) - parseSafeDate(b.etd) ||
      a.vessel.localeCompare(b.vessel);
    const tableRows = list
      .sort(byEtd)
      .map((r) =>
        tr(
          "td",
          cols.map((x) => value(r, x.key)),
        ),
      )
      .join("");
    const footerText = `${bulk.VGM} ${list[0].vgmHours} ${L().VGM_HOURS} ${L().CFS_AFTER}`;

    return `<section><h2 style="${paint}">${esc([origin, dest].join(bulk.JOIN))}</h2><table>${tr(
      "th",
      cols.map((x) => x.label),
      ` style="${paint}"`,
    )}${tableRows}</table><p style="${paint}">${esc(footerText)}</p></section>`;
  };

  const sheet = (rows, title, layout) => {
    const bulk = B(),
      rank = (o) =>
        bulk.ORIGIN_ORDER.findIndex(
          (s) => normalizeStr(s) === normalizeStr(o),
        ) + 1 || 99;

    const sortedGroups = [...group(rows)].sort(
      ([a], [b]) =>
        rank(a.split(bulk.KEY_SEP)[0]) - rank(b.split(bulk.KEY_SEP)[0]) ||
        a.localeCompare(b),
    );

    const body =
      layout === "compact"
        ? sortedGroups.reduce(
            (h, g, i) =>
              h +
              (i % 2 ? "" : `<div class="pair">`) +
              section(g) +
              (i % 2 || i === sortedGroups.length - 1 ? "</div>" : ""),
            "",
          )
        : sortedGroups.map(section).join("");

    return `<article class="sheet" style="background:${bulk.BODY_BG}"><header class="plate"><img src="${new URL(bulk.HEADER, location.href)}" alt=""><h1>${esc(title)}</h1></header>${body}</article>`;
  };

  const doc = (title, html, go) =>
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${new URL(B().CSS, location.href)}"><body>${html}<script>${go}<\/script>`;

  // Export Infrastructure & Rasterization
  let cachedFrame = null;
  const getWorkerFrame = () => {
    if (cachedFrame) return cachedFrame;
    cachedFrame = document.createElement("iframe");
    cachedFrame.style.cssText = "position:fixed;left:-9999px;width:595px";
    document.body.append(cachedFrame);
    return cachedFrame;
  };

  const save = async (title, html, kind) => {
    const bulk = B();
    if (!window.html2canvas)
      await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = bulk.RASTER;
        s.onload = res;
        s.onerror = rej;
        document.head.append(s);
      });

    const frame = getWorkerFrame();
    frame.srcdoc = doc(title, html, "");
    await new Promise((res) => {
      frame.onload = res;
    });

    const canvas = await html2canvas(
      frame.contentDocument.querySelector(".sheet"),
      { scale: 2, useCORS: true },
    );
    const page = bulk.PAGE_PX * 2,
      pages = Math.ceil(canvas.height / page);
    const cuts = !bulk.SINGLE_IMAGE || pages > bulk.PAGE_CAP ? pages : 1;

    // Batch DOM attachments to prevent reflow cycles during downloads
    const fragment = document.createDocumentFragment();
    for (let n = 0; n < cuts; n++) {
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height =
        cuts > 1 ? Math.min(page, canvas.height - n * page) : canvas.height;
      part
        .getContext("2d")
        .drawImage(
          canvas,
          0,
          n * page,
          part.width,
          part.height,
          0,
          0,
          part.width,
          part.height,
        );

      const a = document.createElement("a");
      a.href = part.toDataURL(
        kind === "png" ? "image/png" : "image/jpeg",
        0.92,
      );
      a.download = `${title}${cuts > 1 ? "-" + (n + 1) : ""}.${kind}`;
      fragment.append(a);
      a.click();
    }
    fragment.replaceChildren(); // GC Cleanup immediately
  };

  // UI / Form Controller
  const ask = () =>
    new Promise((done) => {
      const bulk = B(),
        d = document.createElement("dialog");
      d.className = "bulk-modal";

      const radios = (name, items, on) =>
        items
          .map(
            ([id, label]) =>
              `<label><input type="radio" name="${name}" value="${id}"${id === on ? " checked" : ""}> ${esc(label)}</label>`,
          )
          .join("");

      d.innerHTML = `<form><input name="title" value="${esc(bulk.TITLE)}"><p>${esc(bulk.PRINT_AS)}</p>${radios("as", bulk.AS, bulk.AS_DEFAULT)}<p>${esc(bulk.FORMAT)}</p>${radios("layout", bulk.LAYOUTS, bulk.LAYOUT_DEFAULT)}<menu><button type="submit">${esc(bulk.EXECUTE)}</button></menu></form>`;
      document.body.append(d);
      d.showModal();

      const close = (v) => {
        d.remove();
        done(v);
      };
      d.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        close({
          title: String(f.get("title") || "").trim() || bulk.TITLE,
          as: f.get("as"),
          layout: f.get("layout"),
        });
      };
      d.addEventListener("cancel", () => close(null));
      d.addEventListener("click", (e) => {
        if (e.target === d) close(null);
      });
    });

  // Orchestrator Execution Flow
  const run = async () => {
    const pick = await ask();
    if (!pick) return;
    const html = sheet(
      (window.ACT && ACT.visible) || [],
      pick.title,
      pick.layout,
    );

    if (pick.as === "pdf") {
      const w = window.open("", B().WINDOW);
      if (!w) return alert(B().POPUP);
      w.document.write(
        doc(
          pick.title,
          html,
          `const i=document.querySelector("img"),go=()=>print();i?i.complete?go():(i.onload=i.onerror=go):go()`,
        ),
      );
      return w.document.close();
    }
    try {
      await save(pick.title, html, pick.as);
    } catch (e) {
      alert(B().POPUP);
    }
  };

  const bind = () =>
    document.getElementById(B().BTN_ID).addEventListener("click", run);
  document.readyState === "loading"
    ? addEventListener("DOMContentLoaded", bind)
    : bind();
})();
