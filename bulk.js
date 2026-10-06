/** Bulk sheet. Every string, key, color and path comes from CONFIG.BULK / CONFIG.LABELS. */
(function () {
  const B = () => CONFIG.BULK, L = () => CONFIG.LABELS;
  const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ENT[c]);
  const date = (v, pat) => (ACT.parseDate(v) ? ACT.format(v, pat) : CONFIG.MISSING_DATE);
  const tint = (o) => B().ORIGIN_COLORS[o.toLowerCase()] || B().PALETTE[[...o].reduce((a, c) => a + c.charCodeAt(0), 0) % B().PALETTE.length];
  const rank = (o) => B().ORIGIN_ORDER.findIndex((s) => s.toLowerCase() === o.toLowerCase()) + 1 || 99;
  const isImport = (r) => B().ID_PLACES.some((p) => String(r.destination).toLowerCase().includes(p));
  const value = (r, k) =>
    k === "vessel" && r.vessel === CONFIG.EMPTY_TOKEN ? B().TBN
    : k === "duration" ? `${r.duration} ${L().DURATION_UNIT}`
    : B().DATE_OF[k] ? date(r[k], B().DATE_OF[k]) : r[k];
  const tr = (tag, items, attr = "") => `<tr${attr}>${items.map((x) => `<${tag}>${esc(x)}</${tag}>`).join("")}</tr>`;
  const byEtd = (a, b) => (ACT.parseDate(a.etd) || 0) - (ACT.parseDate(b.etd) || 0) || a.vessel.localeCompare(b.vessel);

  const group = (rows) => rows.filter(isImport).reduce((m, r) => {
    const k = [r.origin, r.destination].join(B().KEY_SEP);
    return m.set(k, [...(m.get(k) || []), r]);
  }, new Map());

  const section = ([key, list]) => {
    const [origin, dest] = key.split(B().KEY_SEP), c = tint(origin), cols = B().ORDER;
    const paint = `background:${c.bg};color:${c.ink}`;
    return `<section><h2 style="${paint}">${esc([origin, dest].join(B().JOIN))}</h2><table>${tr("th", cols.map((x) => x.label), ` style="${paint}"`)}${list.sort(byEtd).map((r) => tr("td", cols.map((x) => value(r, x.key)))).join("")}</table><p>${esc(`${B().VGM} ${list[0].vgmHours} ${L().VGM_HOURS} ${L().CFS_AFTER}`)}</p></section>`;
  };

  const sheet = (rows, title) => {
    const groups = [...group(rows)].sort(([a], [b]) => rank(a.split(B().KEY_SEP)[0]) - rank(b.split(B().KEY_SEP)[0]) || a.localeCompare(b));
    return `<article class="sheet" style="background:${B().BODY_BG}"><header class="plate"><img src="${new URL(B().HEADER, location.href)}" alt=""><h1>${esc(title)}</h1></header>${groups.map(section).join("")}</article>`;
  };

  const run = () => {
    const w = window.open("", B().WINDOW);
    if (!w) return alert(B().POPUP);
    const typed = prompt(B().TITLE_PROMPT, B().TITLE);
    if (typed == null) return w.close();
    const title = typed.trim() || B().TITLE, rows = (window.ACT && ACT.visible) || [];
    const printWhenReady = `const i=document.querySelector("img"),go=()=>print();i?i.complete?go():(i.onload=i.onerror=go):go()`;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${new URL(B().CSS, location.href)}"><body>${sheet(rows, title)}<script>${printWhenReady}<\/script>`);
    w.document.close();
  };
  const bind = () => document.getElementById(B().BTN_ID).addEventListener("click", run);
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", bind) : bind();
})();
