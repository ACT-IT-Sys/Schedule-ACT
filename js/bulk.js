/**
 * Bulk sheet orchestrator. High-performance, DRY-compliant interactive PDF/image exporter.
 * @format
 */
(function () {
  const B = () => CONFIG.BULK,
    L = () => CONFIG.LABELS,
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
      );
  const parseSafeDate = (v) => ACT.parseDate(v) || 0,
    norm = (s) => String(s ?? "").toLowerCase();

  const tint = (o) =>
    B().ORIGIN_COLORS[norm(o)] ||
    B().PALETTE[
      [...o].reduce((a, c) => a + c.charCodeAt(0), 0) % B().PALETTE.length
    ];
  const value = (r, k) =>
    k === "vessel" && r.vessel === CONFIG.EMPTY_TOKEN
      ? B().TBN
      : k === "duration"
        ? `${r.duration} ${L().DURATION_UNIT}`
        : B().DATE_OF[k]
          ? ACT.parseDate(r[k])
            ? ACT.format(r[k], B().DATE_OF[k])
            : CONFIG.MISSING_DATE
          : r[k];
  const tr = (tag, items, attr = "") =>
    `<tr${attr}>${items.map((x) => `<${tag}>${x}</${tag}>`).join("")}</tr>`;

  const group = (rows) =>
    rows
      .filter((r) => B().ID_PLACES.some((p) => norm(r.destination).includes(p)))
      .reduce(
        (m, r) =>
          m.set([r.origin, r.destination].join(B().KEY_SEP), [
            ...(m.get([r.origin, r.destination].join(B().KEY_SEP)) || []),
            r,
          ]),
        new Map(),
      );

  const section = ([key, list]) => {
    const bulk = B(),
      [origin, dest] = key.split(bulk.KEY_SEP),
      c = tint(origin),
      paint = `background:${c.bg};color:${c.ink}`;
    const tableRows = list
      .sort(
        (a, b) =>
          parseSafeDate(a.etd) - parseSafeDate(b.etd) ||
          a.vessel.localeCompare(b.vessel),
      )
      .map((r) =>
        tr(
          "td",
          bulk.ORDER.map((x) => esc(value(r, x.key))),
        ),
      )
      .join("");
    const port = list.find((r) => r.port)?.port;
    return `<section><header class="route"><h2 style="${paint}">📍 ${esc([origin, dest].join(bulk.JOIN))}</h2>${port ? `<span style="${paint}">${esc(port.toUpperCase())}</span>` : ""}</header><table>${tr(
      "th",
      bulk.ORDER.map((x) => esc(x.label)),
      ` style="${paint}"`,
    )}${tableRows}</table><p style="${paint}">${esc(`${bulk.VGM} ${list[0]?.vgmHours || CONFIG.DEFAULTS.VGM_HOURS} ${L().VGM_HOURS} ${L().CFS_AFTER}`)}</p></section>`;
  };

  const foot = (cp) => {
    if (!cp) return "";
    const c = CONFIG.CP,
      bits = [];
    if (cp.name) bits.push(`<b>${esc(cp.name)}</b>`);
    if (cp.mobile)
      bits.push(
        `<a href="${c.TEL}${esc(String(cp.mobile).replace(/\D/g, ""))}">${esc(cp.mobile)}</a>`,
      );
    if (cp.email)
      bits.push(`<a href="${c.MAIL}${esc(cp.email)}">${esc(cp.email)}</a>`);
    const marks = c.PLATFORMS.filter((p) => cp[p.key])
      .map(
        (p) =>
          `<a href="${esc(cp[p.key])}"><img src="${new URL(p.icon, location.href)}" alt=""></a>`,
      )
      .join("");
    return `<footer class="cp">${bits.join(esc(c.SEP))}${marks}</footer>`;
  };
  const people = () =>
    people.rows ||
    (people.rows = fetch(
      `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.CP.TAB)}&_t=${Date.now()}`,
    )
      .then((r) => r.text())
      .then((csv) => {
        if (!csv.trim() || csv.trim().startsWith("<")) throw 0;
        return new Promise((res) =>
          Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            complete: (x) => {
              const rows = x.data
                .map((raw) =>
                  Object.fromEntries(
                    Object.entries(raw).map(([k, v]) => [
                      k
                        .replace(/^\ufeff/, "")
                        .trim()
                        .toLowerCase(),
                      String(v ?? "").trim(),
                    ]),
                  ),
                )
                .filter((r) => r.name);
              if (!rows.length) throw 0;
              res(rows);
            },
          }),
        );
      })
      .catch(() => {
        people.rows = null;
        return [];
      }));

  const sheet = (rows, title, layout, cp) => {
    const bulk = B(),
      rank = (o) =>
        bulk.ORIGIN_ORDER.findIndex((s) => norm(s) === norm(o)) + 1 || 99;
    const sorted = [...group(rows)].sort(
      ([a], [b]) =>
        rank(a.split(bulk.KEY_SEP)[0]) - rank(b.split(bulk.KEY_SEP)[0]) ||
        a.localeCompare(b),
    );
    const body =
      layout === "compact"
        ? sorted.reduce(
            (h, g, i) =>
              h +
              (i % 2 ? "" : `<div class="pair">`) +
              section(g) +
              (i % 2 || i === sorted.length - 1 ? "</div>" : ""),
            "",
          )
        : sorted.map(section).join("");
    return `<article class="sheet" id="sheet-root" style="background:${bulk.BODY_BG}"><header class="plate"><img src="${new URL(bulk.HEADER, location.href)}" alt=""><h1>${esc(title)}</h1></header>${body}${foot(cp)}</article>`;
  };

  const doc = (title, html) =>
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${new URL(B().CSS, location.href)}"><body>${html}`;

  const loadDeps = async () => {
    const deps = [];
    if (!window.html2canvas) deps.push(B().RASTER);
    if (!window.jspdf) deps.push(B().PDF);
    for (const src of deps)
      await new Promise((res, rej) =>
        document.head.append(
          Object.assign(document.createElement("script"), {
            src,
            onload: res,
            onerror: rej,
          }),
        ),
      );
  };

  const exportPDF = async (el, title) => {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true }),
      imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new window.jspdf.jsPDF("p", "mm", "a4"),
      wMm = 210,
      hMm = 297,
      scale = wMm / (el.offsetWidth || 595);
    const imgH = (canvas.height * wMm) / canvas.width;
    let left = imgH,
      pos = 0,
      pages = 1;

    pdf.addImage(imgData, "JPEG", 0, pos, wMm, imgH);
    while ((left -= hMm) > 0) {
      pos = left - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, pos, wMm, imgH);
      pages++;
    }

    el.querySelectorAll("a").forEach((link) => {
      const r = link.getBoundingClientRect(),
        cr = el.getBoundingClientRect();
      const topGlobal = (r.top - cr.top) * scale,
        pageIdx = Math.floor(topGlobal / hMm) + 1;
      if (pageIdx <= pages) {
        pdf.setPage(pageIdx);
        pdf.link(
          r.left - cr.left * scale,
          topGlobal % hMm,
          r.width * scale,
          r.height * scale,
          { url: link.href },
        );
      }
    });
    pdf.save(`${title}.pdf`);
  };

  const save = async (title, html, kind) => {
    if (kind === "print") {
      const w = window.open("", B().WINDOW);
      if (!w) return alert(B().POPUP);
      w.document.write(
        doc(title, html) +
          `<script>const i=document.querySelector("img"),go=()=>print();i?i.complete?go():(i.onload=i.onerror=go):go()<\/script>`,
      );
      return w.document.close();
    }
    await loadDeps();
    const frame =
      document.body.append(
        Object.assign(document.createElement("iframe"), {
          style:
            "position:fixed;left:-9999px;width:595px;height:2000px;border:0",
        }),
      ) || document.body.lastChild;
    frame.srcdoc = doc(title, html);
    await new Promise((res) => (frame.onload = res));
    const docu = frame.contentDocument;
    if (docu.fonts?.ready) await docu.fonts.ready;
    const el = docu.getElementById("sheet-root");
    frame.style.height = el.scrollHeight + 24 + "px";

    if (kind === "pdf")
      return await exportPDF(el, title).then(() => frame.remove());

    const canvas = await html2canvas(el, { scale: 2, useCORS: true }),
      p = B().PAGE_PX * 2,
      cuts =
        !B().SINGLE_IMAGE || Math.ceil(canvas.height / p) > B().PAGE_CAP
          ? Math.ceil(canvas.height / p)
          : 1;
    for (let n = 0; n < cuts; n++) {
      const part = Object.assign(document.createElement("canvas"), {
        width: canvas.width,
        height: cuts > 1 ? Math.min(p, canvas.height - n * p) : canvas.height,
      });
      part
        .getContext("2d")
        .drawImage(
          canvas,
          0,
          n * p,
          part.width,
          part.height,
          0,
          0,
          part.width,
          part.height,
        );
      Object.assign(document.createElement("a"), {
        href: part.toDataURL(kind === "png" ? "image/png" : "image/jpeg", 0.92),
        download: `${title}${cuts > 1 ? "-" + (n + 1) : ""}.${kind}`,
      }).click();
    }
    frame.remove();
  };

  const ask = async () => {
    const bulk = B(),
      rows = await people();
    return new Promise((done) => {
      const d =
        document.body.append(
          Object.assign(document.createElement("dialog"), {
            className: "bulk-modal",
          }),
        ) || document.body.lastChild;
      const radios = (n, arr, def) =>
        arr
          .map(
            ([id, lbl]) =>
              `<label><input type="radio" name="${n}" value="${id}"${id === def ? " checked" : ""}> ${esc(lbl)}</label>`,
          )
          .join("");
      const opts = [
        `<option value="">${esc(CONFIG.CP.EMPTY)}</option>`,
        ...rows.map(
          (r, i) =>
            `<option value="${i + 1}"${i + 1 === CONFIG.CP.DEFAULT ? " selected" : ""}>${esc(r.name)} - ${esc(CONFIG.CP.ROW)}${i + 1}</option>`,
        ),
      ].join("");
      d.innerHTML = `<form><input name="title" value="${esc(bulk.TITLE)}"><p>${esc(bulk.PRINT_AS)}</p>${radios("as", bulk.AS, bulk.AS_DEFAULT)}<p>${esc(bulk.FORMAT)}</p>${radios("layout", bulk.LAYOUTS, bulk.LAYOUT_DEFAULT)}<menu><select name="cp">${opts}</select><button type="submit">${esc(bulk.EXECUTE)}</button></menu></form>`;
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
          cp: f.get("cp") ? rows[+f.get("cp") - 1] : null,
        });
      };
      d.addEventListener("cancel", () => close(null));
      d.addEventListener("click", (e) => e.target === d && close(null));
    });
  };

  const run = async () => {
    const pick = await ask();
    if (pick)
      await save(
        pick.title,
        sheet(
          (window.ACT && ACT.visible) || [],
          pick.title,
          pick.layout,
          pick.cp,
        ),
        pick.as,
      ).catch(() => alert(B().POPUP));
  };
  const bind = () =>
    document.getElementById(B().BTN_ID)?.addEventListener("click", run);
  document.readyState === "loading"
    ? addEventListener("DOMContentLoaded", bind)
    : bind();
})();
