/**
 * Card print. Click the card title block, choose ratio / orientation / export, then save.
 * All cardprint settings live in cp.config.js (load it before this file).
 *
 * @format
 */
(function () {
  const C = () => CP_CONFIG;
  const B = () => CONFIG.BULK;
  const K = () => CP_CONFIG;

  const UI = { MARGIN: 16, PAD: 12, GAP: 10 };
  // Background pipeline: smallest plausible data URL, and the default error text.
  // Override the text with CP_CONFIG.LABELS.BG_ERROR.
  const BG = {
    MIN_LEN: 64,
    ERROR: "Background image could not be loaded. Please try again.",
  };
  const bgError = () => C().LABELS?.BG_ERROR || BG.ERROR;
  // Save options. Real values live in CP_CONFIG.SHARE; these only cover a missing block.
  const SHARE_FALLBACK = {
    OPTIONS: [{ id: "download", label: "Download", enabled: true }],
    READY_LABEL: "Save image",
    PRERENDER_MS: 800,
    REVOKE_MS: 60000,
  };
  const SH = () => ({ ...SHARE_FALLBACK, ...K().SHARE });
  const shareOptions = () => {
    const on = SH().OPTIONS.filter((o) => o.enabled !== false);
    return on.length ? on : SHARE_FALLBACK.OPTIONS;
  };
  const BASE_CSS =
    "[hidden]{display:none!important}[data-print],[data-print] *,[data-print] *::before,[data-print] *::after{box-sizing:border-box}";

  const BASE = document.currentScript
    ? new URL(".", document.currentScript.src).href
    : location.href;

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const urlOf = (raw) => (String(raw).match(/url\(["']?([^"')]+)/) || [])[1];

  const state = {
    index: 0,
    row: null,
    bg: "",
    title: "",
    ratio: "",
    orientation: "",
    format: "",
    fit: "height",
    offsetX: 0,
    offsetY: 0,
  };

  /* ---------- fonts ---------- */
  const faces = () => C().FONTS || [];
  const fontUrl = (face, file) => new URL(`${face.DIR}/${file}`, BASE).href;
  const fontCss = () =>
    faces()
      .flatMap((face) =>
        face.FILES.map(
          ({ weight, file }) =>
            `@font-face{font-family:"${face.FAMILY}";font-weight:${weight};font-style:normal;font-display:block;src:url("${fontUrl(face, file)}") format("${face.FORMAT}")}`,
        ),
      )
      .join("");
  const fontSpecs = () =>
    faces().flatMap((face) =>
      face.FILES.map(({ weight }) => `${weight} 1em "${face.FAMILY}"`),
    );
  const loadFonts = (d = document) =>
    Promise.all(fontSpecs().map((spec) => d.fonts.load(spec))).catch(() => {});

  /* ---------- choices ---------- */
  const formats = () => K().FORMATS.filter((f) => !K().HIDDEN.includes(f.id));
  const pick = (list, ...ids) =>
    ids.map((id) => list.find((x) => x.id === id)).find(Boolean) || list[0];
  const saved = () => {
    if (!K().REMEMBER) return {};
    try {
      return JSON.parse(localStorage.getItem(K().STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const remember = () => {
    if (!K().REMEMBER) return;
    try {
      const { ratio, orientation, format } = state;
      localStorage.setItem(
        K().STORAGE_KEY,
        JSON.stringify({ ratio, orientation, format }),
      );
    } catch (e) {}
  };
  const ratioOf = () => K().RATIOS.find((r) => r.id === state.ratio);
  const isSquare = () => ratioOf().w === ratioOf().h;

  /* ---------- canvas ---------- */
  const dims = () => {
    const { w: rw, h: rh } = ratioOf();
    const [short, long] = [rw, rh].sort((a, b) => a - b);
    const side = Math.round((K().BASE * long) / short);
    const wide = !isSquare() && state.orientation === "landscape";
    const w = wide ? side : K().BASE;
    const h = wide ? K().BASE : side;
    return {
      w,
      h,
      ratio: state.ratio,
      orientation: wide ? "landscape" : "portrait",
      layout: w >= h ? "wide" : "tall",
    };
  };

  const fitContent = (root) => {
    const plate = root.querySelector("[data-plate]") || root;
    const { MAX_PASSES, SAFETY } = K().FIT;
    let f = parseFloat(root.style.getPropertyValue("--cp-fit")) || 1;
    for (let i = 0; i < MAX_PASSES; i++) {
      const over = Math.min(
        plate.clientHeight / plate.scrollHeight,
        plate.clientWidth / plate.scrollWidth,
      );
      if (!(over < 1)) break;
      f *= over * SAFETY;
      root.style.setProperty("--cp-fit", f);
    }
  };

  const sizeRoot = (root) => {
    const c = dims();
    root.style.setProperty("--cp-wn", c.w);
    root.style.setProperty("--cp-hn", c.h);
    root.style.removeProperty("--cp-fit");
    Object.assign(root.dataset, {
      ratio: c.ratio,
      orientation: c.orientation,
      layout: c.layout,
    });
    fitContent(root);
  };

  /* ---------- design data ---------- */
  const title = () => state.title.trim() || C().TITLE;

  const dateParts = (src) => {
    const d = window.ACT && ACT.parseDate(src);
    if (!d) return {};
    const m = d.getMonth() + 1,
      pad = (n) => String(n).padStart(2, "0");
    return {
      YYYY: d.getFullYear(),
      YY: pad(d.getFullYear() % 100),
      MMMM: CONFIG.MONTH_LABELS[m],
      MMM: CONFIG.MONTH_SHORT[m],
      MM: pad(m),
      DD: pad(d.getDate()),
      D: d.getDate(),
    };
  };

  const field = (row, key) => {
    const fmt = window.ACT && ACT.format;
    const dates = { etd: row.etd, eta: row.eta, cfs: row.cfsCutOff };
    if (key in dates) return fmt ? fmt(dates[key]) : dates[key] || "";
    if (key === "title") return title();
    if (key === "address") return (C().ADDRESS || []).join(" ");
    if (key === "site") return C().SITE;
    if (key === "duration")
      return row.duration > 0
        ? `${row.duration} ${CONFIG.LABELS.DURATION_UNIT}`
        : "";
    if (key === "vessel" && row.vessel === CONFIG.EMPTY_TOKEN) return B().TBN;
    return row[key] || "";
  };

  // Priority: temporary upload > per-design non-empty bg > global bg > none
  const plateUrl = (design) => {
    if (state.bg) return state.bg;
    const own =
      design && "bg" in design && design.bg !== "" ? design.bg : C().bg;
    if (!own) return "";
    return new URL(own, BASE).href;
  };

  // Apply fit + pan to a plate element (preview or export bake).
  const plateBg = (plate) =>
    plate.style.backgroundImage || plate.style.getPropertyValue("--cp-bg");

  const applyBgFit = (plate, resolved) => {
    if (!plate) return;
    const raw = resolved || plate.style.getPropertyValue("--cp-bg");
    if (!raw || raw === "none") {
      plate.style.backgroundImage = "none";
      return;
    }
    const src = urlOf(raw) || raw;
    const img = `url("${src}")`;
    const size = state.fit === "height" ? "auto 100%" : "100% auto";
    const pos = `${50 + state.offsetX}% ${50 + state.offsetY}%`;
    plate.style.setProperty("--cp-bg", img);
    plate.style.backgroundImage = img;
    plate.style.backgroundSize = size;
    plate.style.webkitBackgroundSize = size;
    plate.style.backgroundPosition = pos;
    plate.style.backgroundRepeat = "no-repeat";
  };

  const waitBg = (plate) => {
    const url = plate && urlOf(plateBg(plate));
    if (!url) return Promise.resolve();
    return new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = () => res();
      img.src = url;
    });
  };

  const fill = async (root, row, design) => {
    root.querySelectorAll("[data-field]").forEach((node) => {
      node.textContent = field(row, node.dataset.field);
    });
    root.querySelectorAll("[data-date]").forEach((node) => {
      const key = node.dataset.date;
      const src = key === "cfs" ? row.cfsCutOff : row[key];
      const part = node.dataset.part;
      node.textContent = (part && dateParts(src)[part]) || field(row, key);
    });
    const labels = C().COLUMN_LABELS || {};
    root.querySelectorAll("[data-label]").forEach((node) => {
      const key = node.dataset.label;
      node.textContent = labels[key] ?? CONFIG.LABELS[key] ?? key ?? "";
    });
    root.querySelectorAll("[data-hide-empty]").forEach((node) => {
      const probes = [node, ...node.querySelectorAll("[data-field]")];
      node.hidden = !probes.some(
        (n) => n.dataset.field && n.textContent.trim(),
      );
    });
    const exclude = new Set(design?.exclude || []);
    if (exclude.size) {
      root.querySelectorAll("[data-field],[data-label]").forEach((node) => {
        const key = node.dataset.field || node.dataset.label;
        if (key && exclude.has(key)) node.hidden = true;
      });
    }
    root.querySelectorAll("img[src]").forEach((img) => {
      img.src = new URL(img.getAttribute("src"), location.href).href;
    });
    const plate = root.querySelector("[data-plate]");
    if (plate) {
      const url = plateUrl(design);
      if (url) {
        const resolved = url.startsWith("data:")
          ? url
          : await resolveBg(url).catch(() => url);
        applyBgFit(plate, resolved);
      } else {
        plate.style.removeProperty("--cp-bg");
        applyBgFit(plate);
      }
    }
  };

  /* ---------- export helpers (unchanged logic, abbreviated for scope) ---------- */
  const loadImage = (src) =>
    new Promise((res) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });

  const plateHtml = (node) => {
    const clone = node.cloneNode(true);
    clone.style.transform = "none";
    clone.style.transformOrigin = "";
    return clone.outerHTML;
  };

  const imagesReady = (d) =>
    Promise.all(
      [...d.images].map((img) =>
        img.complete
          ? 0
          : new Promise((res) => (img.onload = img.onerror = res)),
      ),
    );
  const settle = async (d) => {
    await loadFonts(d);
    await imagesReady(d);
    await waitBg(d.querySelector("[data-plate]"));
    if (d.fonts?.ready) await d.fonts.ready;
  };

  const readyScript = () =>
    `<script>Promise.all([${JSON.stringify(fontSpecs())}.map(s=>document.fonts.load(s)),[...document.images].map(i=>i.complete?0:new Promise(r=>i.onload=i.onerror=r))].flat()).catch(()=>{}).then(()=>document.fonts.ready).then(()=>setTimeout(()=>print(),100))<\/script>`;

  const doc = (name, html, css, size, run = "") =>
    `<!doctype html><meta charset="utf-8"><title>${esc(name)}</title><style>${fontCss()}@page{size:${size.w}px ${size.h}px;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;width:${size.w}px;height:${size.h}px;overflow:hidden}${BASE_CSS}${css}</style><body>${html}${run}`;

  const mount = async (name, html, css) => {
    const c = dims();
    const frame = Object.assign(document.createElement("iframe"), {
      style: `position:fixed;left:-9999px;top:0;width:${c.w}px;height:${c.h}px;border:0`,
    });
    document.body.append(frame);
    frame.srcdoc = doc(name, html, css, c);
    await new Promise((res) => (frame.onload = res));
    const d = frame.contentDocument;
    await settle(d);
    return { frame, d };
  };

  const loadDeps = async (kind) => {
    const deps = [];
    if (!window.snapdom) deps.push(K().RASTER);
    if (kind === "pdf" && !window.jspdf) deps.push(B().PDF);
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

  /* ---------- export ---------- */
  const fmt = () => K().FORMATS.find((x) => x.id === state.format);
  const opaque = (hex) => hex.slice(0, 7).toLowerCase();

  const exportInfo = () => {
    const f = fmt();
    const c = dims();
    const scale = f.scale || 1;
    const name = `${state.row.vessel || "card"}-${state.row.voyage || "schedule"}-${c.w * scale}x${c.h * scale}`;
    return { f, c, scale, name };
  };

  // Swap the plate background for a baked data URL (see resolveBg).
  const bakeBg = async (node) => {
    const plate = node.querySelector("[data-plate]");
    const src = plate && (urlOf(plateBg(plate)) || "");
    if (!src || src.startsWith("data:")) return;
    try {
      applyBgFit(plate, await resolveBg(src));
    } catch (e) {
      applyBgFit(plate, src);
    }
  };

  const rasterize = async (html, css, { f, name, scale }) => {
    await loadDeps(f.kind);
    const wait = K().EXPORT_WAIT || {};
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const capture = async () => {
      const { frame, d } = await mount(name, html, css);
      const el = d.querySelector("[data-print]");
      const plate = d.querySelector("[data-plate]");
      const bg = plate && urlOf(plateBg(plate));
      if (bg) {
        const probe = new Image();
        probe.src = bg;
        if (probe.decode) await probe.decode().catch(() => {});
      }
      await pause(wait.DECODE_MS || 0);
      const result = await window.snapdom(el, {
        scale,
        backgroundColor: K().EXPORT_BG,
      });
      frame.remove();
      return result;
    };
    const blank = async (res) => {
      try {
        const cv = await res.toCanvas();
        const ctx = cv.getContext("2d");
        const pts = [
          [8, 8],
          [cv.width - 8, 8],
          [8, cv.height - 8],
        ];
        const bg = opaque(K().EXPORT_BG);
        return pts.every(([x, y]) => {
          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
          const hex =
            "#" +
            [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
          return hex === bg;
        });
      } catch (e) {
        return false;
      }
    };
    let result = await capture();
    for (let i = 0; i < (wait.RETRY || 0) && (await blank(result)); i++)
      result = await capture();
    return result;
  };

  // Raster result -> File in the format's own mime (JPEG is flattened: it has no alpha).
  const toFile = async (result, { f, name }) => {
    const src = await result.toCanvas();
    let cv = src;
    if (f.mime !== "image/png") {
      cv = Object.assign(document.createElement("canvas"), {
        width: src.width,
        height: src.height,
      });
      const ctx = cv.getContext("2d");
      ctx.fillStyle = opaque(K().EXPORT_BG);
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(src, 0, 0);
    }
    const blob = await new Promise((res) => cv.toBlob(res, f.mime, f.quality));
    if (!blob) throw new Error("export failed");
    return new File([blob], `${name}.${f.ext}`, { type: f.mime });
  };

  // Image file for the current card, with no delivery step (used by pre-render).
  const renderFile = async (node, css) => {
    const info = exportInfo();
    await bakeBg(node);
    return toFile(await rasterize(plateHtml(node), css, info), info);
  };

  /* ---------- delivery ---------- */
  const saveBlob = (file) => {
    const href = URL.createObjectURL(file);
    Object.assign(document.createElement("a"), {
      href,
      download: file.name,
    }).click();
    setTimeout(() => URL.revokeObjectURL(href), SH().REVOKE_MS);
  };

  // Native share sheet when the browser can share files, plain download otherwise.
  const shareFile = async (file) => {
    if (!(navigator.share && navigator.canShare?.({ files: [file] })))
      return saveBlob(file);
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e.name !== "AbortError") saveBlob(file);
    }
  };

  const closeMenu = (host) => host.querySelector(".share-menu")?.remove();
  const popMenu = (host, html) => {
    closeMenu(host);
    const menu = Object.assign(document.createElement("div"), {
      className: "share-menu",
      innerHTML: html,
    });
    host.append(menu);
    return menu;
  };

  // iOS only opens the share sheet from a fresh tap, so a finished render waits for one.
  const offerShare = (file, host) =>
    popMenu(
      host,
      `<button type="button" data-ready>${esc(SH().READY_LABEL)}</button>`,
    ).addEventListener("click", () => {
      closeMenu(host);
      shareFile(file);
    });

  // mode: download | share | ready. Print and PDF keep their own delivery.
  const save = async (node, css, mode, host) => {
    const info = exportInfo();
    const { f, c, name } = info;
    await bakeBg(node);
    const html = plateHtml(node);

    if (f.kind === "print") {
      const { frame, d } = await mount(name, html, css);
      const baked = d.querySelector("[data-print]").outerHTML;
      frame.remove();
      const w = window.open("", B().WINDOW);
      if (!w) return alert(B().POPUP);
      const printCss = `@page{margin:0}html,body{margin:0;width:auto;height:auto;overflow:visible}[data-print]{transform-origin:top left}`;
      const printScript = `<script>
        Promise.all([${JSON.stringify(fontSpecs())}.map(s=>document.fonts.load(s)),[...document.images].map(i=>i.complete?0:new Promise(r=>i.onload=i.onerror=r))].flat()).catch(()=>{}).then(()=>document.fonts.ready).then(()=>{
          const el=document.querySelector("[data-print]");
          if(el){
            const pw=window.innerWidth||document.documentElement.clientWidth;
            const ph=window.innerHeight||document.documentElement.clientHeight;
            const s=Math.min(pw/${c.w},ph/${c.h});
            el.style.transform="scale("+s+")";
            document.body.style.width=(${c.w}*s)+"px";
            document.body.style.height=(${c.h}*s)+"px";
          }
          setTimeout(()=>print(),150);
        });
      <\/script>`;
      w.document.write(doc(name, baked, css + printCss, c, printScript));
      return w.document.close();
    }

    const result = await rasterize(html, css, info);

    if (f.kind === "pdf") {
      const canvas = await result.toCanvas();
      const mm = (px) => (px * 25.4) / K().PDF_DPI;
      const pdf = new window.jspdf.jsPDF({
        orientation: c.w > c.h ? "l" : "p",
        unit: "mm",
        format: [mm(c.w), mm(c.h)],
      });
      pdf.addImage(
        canvas.toDataURL("image/jpeg", f.quality),
        "JPEG",
        0,
        0,
        mm(c.w),
        mm(c.h),
      );
      return pdf.save(`${name}.pdf`);
    }
    const file = await toFile(result, info);
    return mode === "download" ? saveBlob(file) : offerShare(file, host);
  };

  /* ---------- background ---------- */
  const dropBg = () => {
    state.bg = "";
  };

  const isDataImage = (v) =>
    typeof v === "string" &&
    v.startsWith("data:image/") &&
    v.length > BG.MIN_LEN;

  const shrink = async (file) => {
    try {
      const { MAX_SIDE, QUALITY } = K().UPLOAD;
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const cv = Object.assign(document.createElement("canvas"), {
        width: Math.round(bmp.width * s),
        height: Math.round(bmp.height * s),
      });
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      bmp.close?.();
      const out = cv.toDataURL("image/jpeg", QUALITY);
      if (!isDataImage(out)) throw new Error("empty canvas");
      return out;
    } catch (e) {
      return new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => res("");
        r.readAsDataURL(file);
      });
    }
  };

  // One pipeline for every background: fetch -> blob -> shrink -> data URL (cached).
  // Uploads are already data URLs and pass through. Rejects instead of returning junk.
  const bgCache = new Map();
  const resolveBg = (src) => {
    if (!src || src.startsWith("data:")) return Promise.resolve(src || "");
    if (!bgCache.has(src))
      bgCache.set(
        src,
        fetch(src)
          .then((r) => {
            if (!r.ok) throw new Error(`${r.status} ${src}`);
            return r.blob();
          })
          .then(shrink)
          .then((out) => {
            if (!isDataImage(out)) throw new Error(`Unusable image ${src}`);
            return out;
          })
          .catch((e) => {
            bgCache.delete(src);
            throw e;
          }),
      );
    return bgCache.get(src);
  };

  /* ---------- dialog ---------- */
  const style = document.createElement("style");
  style.textContent = `${fontCss()}
.cardprint{border:0;border-radius:16px;padding:${UI.PAD}px;width:min(100vw - ${UI.MARGIN}px,720px);max-height:calc(100dvh - ${UI.MARGIN}px - env(safe-area-inset-bottom,0px));overflow:auto;display:flex;flex-direction:column}
.cardprint::backdrop{background:rgba(15,23,42,.45)}
.cardprint form{display:grid;grid-template-rows:auto 1fr auto;gap:${UI.GAP}px;max-height:100%;min-height:0;overflow:hidden}
.cardprint form>header,.cardprint form>footer{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.cardprint .stage{display:grid;justify-content:center;overflow:hidden;min-height:0;touch-action:none}
.cardprint button,.cardprint select,.cardprint [data-title],.cardprint .pick-bg{font:inherit;min-height:36px;border:1px solid #d7e0da;border-radius:10px;background:#fff;color:inherit;padding:0 10px;cursor:pointer}
.cardprint [data-title]{flex:1 1 auto;min-width:0;padding:0 12px;cursor:text}
.cardprint .pick-bg{display:inline-flex;align-items:center}
.cardprint [data-act=save]{margin-left:auto;background:#047857;border-color:#047857;color:#fff;font-weight:600}
.cardprint select:disabled{opacity:.45;cursor:default}
.bg-picker{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;background:#fff;border:1px solid #d7e0da;border-radius:12px;padding:10px;box-shadow:0 8px 24px rgba(15,23,42,.18);display:grid;grid-template-columns:repeat(3,72px);gap:8px;max-width:calc(100% - 24px)}
.bg-picker button{aspect-ratio:1;padding:0;overflow:hidden;border-radius:8px;border:1px solid #e5e7eb}
.bg-picker img{width:100%;height:100%;object-fit:cover;display:block}
.cardprint form{position:relative}
.cardprint form>footer{position:relative}
.cardprint [data-act=save]:disabled{background:#b91c1c;border-color:#b91c1c;color:#fff;letter-spacing:.2em;cursor:progress;opacity:1}
.share-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:20;display:grid;gap:6px;min-width:200px;max-width:100%;background:#fff;border:1px solid #d7e0da;border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(15,23,42,.18)}
.share-menu button{text-align:left;justify-content:flex-start}`;
  document.head.append(style);

  const open = (row) => {
    const prev = saved();
    state.row = row;
    state.title = C().TITLE;
    state.ratio = pick(K().RATIOS, prev.ratio, K().DEFAULTS.ratio).id;
    state.orientation = pick(
      K().ORIENTATIONS,
      prev.orientation,
      K().DEFAULTS.orientation,
    ).id;
    state.format = pick(formats(), prev.format, K().DEFAULTS.format).id;

    const cfg = C(),
      designs = (cfg.DESIGNS || []).filter((d) => d.enabled !== false),
      multi = designs.length > 1;
    const dialog = Object.assign(document.createElement("dialog"), {
      className: "cardprint",
    });
    const nav = (act, label, glyph, extra = "") =>
      `<button type="button" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}"${extra}>${glyph}</button>`;
    const choice = (key, label, list) =>
      `<select data-pick="${key}" aria-label="${esc(label)}" title="${esc(label)}">${list
        .map(
          (x) =>
            `<option value="${esc(x.id)}"${x.id === state[key] ? " selected" : ""}>${esc(x.label)}</option>`,
        )
        .join("")}</select>`;

    dialog.innerHTML = `<form method="dialog">
<header>${multi ? nav("prev", cfg.PREV, "‹") : ""}<input data-title value="${esc(state.title)}" aria-label="${esc(B().TITLE_PROMPT)}">${multi ? nav("next", cfg.NEXT, "›") + nav("dice", cfg.DICE, "🎲") : ""}<button type="button" class="pick-bg" data-act="bg-pick" title="${esc(cfg.BG_LABEL)}">🖼️</button>${nav("reset", cfg.RESET_BG, "↺", " hidden")}<button type="button" data-act="fit-height" title="${esc(cfg.LABELS.FIT_HEIGHT)}" ${state.fit === "height" ? "aria-pressed=true" : ""}>↕</button><button type="button" data-act="fit-width" title="${esc(cfg.LABELS.FIT_WIDTH)}" ${state.fit === "width" ? "aria-pressed=true" : ""}>↔</button>${nav("close", cfg.CLOSE, "❌")}</header>
<div class="stage" data-stage></div>
<footer>
  <input type="file" accept="image/*" data-bg hidden aria-label="${esc(cfg.BG_LABEL)}">
  ${choice("ratio", cfg.LABELS.RATIO, cfg.RATIOS)}
  ${choice("orientation", cfg.LABELS.ORIENTATION, cfg.ORIENTATIONS)}
  ${formats().length > 1 ? choice("format", cfg.LABELS.FORMAT, formats()) : ""}
  <button type="button" data-act="save">${esc(cfg.LABELS.EXPORT || "Export")}</button>
</footer>
</form>`;
    document.body.append(dialog);

    const $ = (sel) => dialog.querySelector(sel);
    const stage = $("[data-stage]");
    let css = "",
      painting = 0;

    const syncOrientation = () => {
      $('[data-pick="orientation"]').disabled = isSquare();
    };

    const fit = () => {
      const root = stage.querySelector("[data-print]");
      if (!root) return;
      root.style.transform = "none";
      const pad = cfg.FIT_PAD;
      const chrome =
        $("form > header").offsetHeight + $("form > footer").offsetHeight;
      const vh = window.visualViewport?.height || innerHeight;
      const availW = dialog.clientWidth - pad * 2;
      const availH = vh - UI.MARGIN - UI.PAD * 2 - UI.GAP * 2 - chrome - pad;
      const scale = Math.min(
        1,
        availW / root.offsetWidth,
        Math.max(120, availH) / root.offsetHeight,
      );
      root.style.transformOrigin = "top center";
      root.style.transform = `scale(${scale})`;
      stage.style.height = `${root.offsetHeight * scale}px`;
    };

    const relayout = () => {
      const root = stage.querySelector("[data-print]");
      if (!root) return;
      sizeRoot(root);
      fit();
    };

    // Pre-render ("ready" option): render quietly after the last change so a tap can share at once.
    const footer = $("form > footer");
    const prerender = { timer: 0, run: 0, job: null, file: null, sig: "" };
    const sig = () =>
      JSON.stringify([
        state.index,
        state.ratio,
        state.orientation,
        state.format,
        state.fit,
        state.offsetX,
        state.offsetY,
        state.title,
        state.bg.length,
        state.bg.slice(-32),
      ]);
    const optionOn = (id) => shareOptions().some((o) => o.id === id);
    const startPrerender = () => {
      const mine = sig();
      const run = prerender.run;
      const promise = renderFile(stage.querySelector("[data-print]"), css).then(
        (file) => {
          if (run !== prerender.run) throw new Error("stale");
          prerender.file = file;
          prerender.sig = mine;
          return file;
        },
      );
      prerender.job = { sig: mine, promise };
      promise.catch(() => {});
    };
    // Call after anything that changes the card: drops stale output, schedules a new one.
    const touch = () => {
      prerender.run++;
      prerender.job = prerender.file = null;
      clearTimeout(prerender.timer);
      closeMenu(footer);
      if (optionOn("ready") && fmt().kind === "image")
        prerender.timer = setTimeout(startPrerender, SH().PRERENDER_MS);
    };

    const run = (mode) => {
      const fresh = prerender.file && prerender.sig === sig();
      if (mode === "ready" && fmt().kind === "image" && fresh)
        return shareFile(prerender.file); // no await before this: keeps the tap valid
      const btn = $('[data-act="save"]');
      const waitLabel = cfg.LABELS.WAIT || "W A I T";
      const exportLabel = cfg.LABELS.EXPORT || "Export";
      btn.disabled = true;
      btn.textContent = waitLabel;
      const task = async () => {
        const job = prerender.job?.sig === sig() && prerender.job.promise;
        if (mode === "ready" && job) {
          const file = await job.catch(() => null);
          if (file) return offerShare(file, footer);
        }
        return save(stage.querySelector("[data-print]"), css, mode, footer);
      };
      return task()
        .catch(() => alert(B().POPUP))
        .finally(() => { btn.disabled = false; btn.textContent = exportLabel; });
    };

    const onSave = () => {
      const opts = shareOptions();
      if (opts.length === 1 || fmt().kind !== "image") return run(opts[0].id);
      if (footer.querySelector(".share-menu")) return closeMenu(footer);
      popMenu(
        footer,
        opts
          .map(
            (o) =>
              `<button type="button" data-share="${esc(o.id)}">${esc(o.label || o.id)}</button>`,
          )
          .join(""),
      ).addEventListener("click", (e) => {
        const id = e.target.closest("[data-share]")?.dataset.share;
        if (!id) return;
        closeMenu(footer);
        run(id);
      });
    };

    const loadDesign = async () => {
      const design = designs[state.index];
      const oCssUrl =
        design.oCss === true
          ? design.css.replace(/[^/]+$/, "o.css")
          : design.oCss || "";
      const [html, designCss, overrideCss] = await Promise.all([
        fetch(design.html).then((r) => r.text()),
        fetch(design.css).then((r) => r.text()),
        oCssUrl
          ? fetch(oCssUrl)
              .then((r) => (r.ok ? r.text() : ""))
              .catch(() => "")
          : Promise.resolve(""),
      ]);
      return {
        design,
        html,
        css: designCss + (overrideCss ? "\n" + overrideCss : ""),
      };
    };

    const paint = async () => {
      const run = ++painting;
      const loaded = await loadDesign();
      if (run !== painting) return;
      css = loaded.css;
      stage.innerHTML = `<style>${BASE_CSS}${css}</style>${loaded.html}`;
      const root = stage.querySelector("[data-print]");
      if (loaded.design.theme) root.dataset.theme = loaded.design.theme;
      await fill(stage, state.row, loaded.design);
      $('[data-act="reset"]').hidden = !state.bg;
      await waitBg(stage.querySelector("[data-plate]"));
      await loadFonts();
      if (run === painting) {
        relayout();
        touch();
      }
    };

    const step = (n) => {
      state.index = (state.index + n + designs.length) % designs.length;
      paint();
    };

    const showBgPicker = () => {
      const existing = dialog.querySelector(".bg-picker");
      if (existing) return existing.remove();
      const picker = document.createElement("div");
      picker.className = "bg-picker";
      const items = (cfg.BACKGROUNDS || [])
        .map(
          (b) =>
            `<button type="button" data-file="${esc(b.file)}" title="${esc(b.label)}"><img src="${esc(new URL(b.file, BASE).href)}" alt="${esc(b.label)}"></button>`,
        )
        .join("");
      picker.innerHTML =
        items +
        `<button type="button" data-act="upload" title="Upload temporary">⬆️</button>`;
      stage.parentElement.append(picker);
      picker.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.dataset.file) {
          dropBg();
          const abs = new URL(btn.dataset.file, BASE).href;
          state.bg = await resolveBg(abs).catch(() => abs);
          picker.remove();
          paint();
        } else if (btn.dataset.act === "upload") {
          $("[data-bg]").click();
          picker.remove();
        }
      });
    };

    dialog.addEventListener("click", (event) => {
      if (!event.target.closest(".share-menu,[data-act=save]"))
        closeMenu(footer);
      const act = event.target.closest("[data-act]")?.dataset.act;
      if (act === "prev") step(-1);
      else if (act === "next") step(1);
      else if (act === "dice") {
        if (designs.length > 1)
          step(1 + Math.floor(Math.random() * (designs.length - 1)));
      } else if (act === "reset") {
        dropBg();
        paint();
      } else if (act === "bg-pick") showBgPicker();
      else if (act === "save") onSave();
      else if (act === "close") dialog.close();
    });

    dialog.addEventListener("change", (event) => {
      const key = event.target.dataset.pick;
      if (!key) return;
      state[key] = event.target.value;
      syncOrientation();
      remember();
      if (key !== "format") relayout();
      touch();
    });

    // Background fit + pan (does not capture events on content)
    const setFit = (fit) => {
      state.fit = fit;
      state.offsetX = 0;
      state.offsetY = 0;
      const plate = stage.querySelector("[data-plate]");
      applyBgFit(plate);
      touch();
      dialog.querySelectorAll("[data-act^=fit-]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.act === "fit-" + fit));
      });
    };
    dialog.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "fit-height") setFit("height");
      else if (act === "fit-width") setFit("width");
    });

    let panning = false,
      lastX = 0,
      lastY = 0;
    stage.addEventListener(
      "pointerdown",
      (e) => {
        if (
          e.target.closest(
            "[data-field],[data-date],[data-label],button,input,select",
          )
        )
          return;
        const plate = stage.querySelector("[data-plate]");
        if (!plate || !plate.style.getPropertyValue("--cp-bg")) return;
        panning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
        stage.setPointerCapture?.(e.pointerId);
      },
      { passive: false },
    );
    stage.addEventListener("pointermove", (e) => {
      if (!panning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const plate = stage.querySelector("[data-plate]");
      if (!plate) return;
      const rect = plate.getBoundingClientRect();
      if (state.fit === "height") state.offsetX += (dx / rect.width) * 100;
      else state.offsetY += (dy / rect.height) * 100;
      applyBgFit(plate);
    });
    const endPan = () => {
      if (panning) touch();
      panning = false;
    };
    stage.addEventListener("pointerup", endPan);
    stage.addEventListener("pointercancel", endPan);

    $("[data-title]").addEventListener("input", (event) => {
      state.title = event.target.value;
      stage.querySelectorAll('[data-field="title"]').forEach((node) => {
        node.textContent = title();
      });
      relayout();
      touch();
    });

    $("[data-bg]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      dropBg();
      state.bg = await shrink(file);
      paint();
    });

    $("form").addEventListener("submit", (event) => event.preventDefault());

    const onResize = () => fit();
    addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    dialog.addEventListener("close", () => {
      removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      prerender.run++;
      clearTimeout(prerender.timer);
      dropBg();
      dialog.remove();
    });

    try {
      dialog.showModal();
    } catch (e) {
      dialog.remove();
      return;
    }
    if (!dialog.open) {
      dialog.remove();
      return;
    }
    syncOrientation();
    paint();
  };

  const bind = () => {
    const cards = document.getElementById("cards");
    if (!cards) return;
    cards.addEventListener("click", (event) => {
      const hit = event.target.closest(".origin-hit, .route-top > div:first-child");
      const card = hit && hit.closest(".card");
      if (!card) return;
      event.preventDefault();
      const row = ((window.ACT && ACT.visible) || [])[Number(card.dataset.i)];
      if (row) open(row);
    });
  };
  document.readyState === "loading"
    ? addEventListener("DOMContentLoaded", bind)
    : bind();
})();
