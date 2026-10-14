/**
 * The particle layer that sits over (and under) the whole site.
 *
 * Depth: three particle layers across two canvases.
 *   layer 0 — far: tiny, slow, drawn on the BACK canvas (behind the content)
 *   layer 1 — mid: normal flakes on the FRONT canvas; these are the ones that settle on surfaces
 *   layer 2 — near: a few big blurred flakes on the FRONT canvas, moving fast past the "camera"
 * Scrolling moves each layer by a different amount, which is what sells the depth.
 *
 * Surfaces: elements marked `data-snow-surface` (card tops) or `data-snow-text` (a word whose
 * glyphs carry `data-glyph`) collect settled snow. Scroll hard and it slides off.
 */

export type FxMode = "snow" | "rain" | "storm" | "fog" | "dust";

type Kind = "flake" | "drop" | "mote" | "shed" | "splash";

interface Particle {
  x: number;
  y: number;
  py: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  layer: 0 | 1 | 2;
  kind: Kind;
  alpha: number;
  life: number;
}

interface Surface {
  el: HTMLElement;
  kind: "card" | "text";
  heights: Float32Array;
  /** Per-bin offset of the surface below the element's top edge; NaN = no surface here. */
  contour: Float32Array;
  cap: number;
  variant: string;
  width: number;
  rect: DOMRect;
  visible: boolean;
}

const BIN = 3;
const DEPTH = [0.18, 0.5, 1.1]; // how much each layer follows the scroll
const MAX_SHED_PER_FRAME = 40;

const TARGETS: Record<FxMode, [number, number, number]> = {
  snow: [120, 85, 12],
  fog: [50, 30, 5],
  rain: [80, 150, 0],
  storm: [110, 210, 0],
  dust: [0, 45, 0],
};

function sprite(size: number, soft: number, color = "255,255,255"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${color},1)`);
  grad.addColorStop(soft, `rgba(${color},0.85)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export class WeatherScene {
  private back: CanvasRenderingContext2D;
  private front: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  private counts: [number, number, number] = [0, 0, 0];
  private mode: FxMode = "snow";
  private intensity = 1;
  private density = 1;
  private fog = 0;
  private fogTarget = 0;
  private flash = 0;
  private t = 0;
  private wind = 0.25;
  private dawn = 0;
  private surfaces = new Map<HTMLElement, Surface>();
  private sprites = {
    sharp: sprite(32, 0.45),
    soft: sprite(96, 0.1),
    shadow: sprite(32, 0.3, "70,80,110"),
  };
  private fogBlobs = Array.from({ length: 7 }, (_, i) => ({
    x: Math.random(),
    y: 0.25 + Math.random() * 0.7,
    r: 0.35 + Math.random() * 0.35,
    v: (0.00015 + Math.random() * 0.0003) * (i % 2 ? 1 : -1),
  }));

  constructor(back: HTMLCanvasElement, front: HTMLCanvasElement, private reducedMotion = false) {
    this.back = back.getContext("2d")!;
    this.front = front.getContext("2d")!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const ctx of [this.back, this.front]) {
      ctx.canvas.width = Math.round(this.w * this.dpr);
      ctx.canvas.height = Math.round(this.h * this.dpr);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    const area = (this.w * this.h) / (1440 * 900);
    this.density = Math.min(1.3, Math.max(0.4, area)) * (this.reducedMotion ? 0.3 : 1);
    this.surfaces.forEach((s) => (s.width = -1)); // force contour rebuild
  }

  setMode(mode: FxMode, intensity = 1) {
    this.mode = mode;
    this.intensity = intensity;
    this.fogTarget = mode === "fog" ? 1 : mode === "rain" || mode === "storm" ? 0.25 : 0;
    this.wind = mode === "storm" ? 2.2 : mode === "rain" ? 1.2 : mode === "dust" ? 0.15 : 0.25;
  }

  /** Discover surfaces in the DOM. Cheap enough to call a couple of times a second. */
  refreshSurfaces() {
    const found = new Set<HTMLElement>();
    document.querySelectorAll<HTMLElement>("[data-snow-surface],[data-snow-text]").forEach((el) => {
      found.add(el);
      if (!this.surfaces.has(el)) {
        this.surfaces.set(el, {
          el,
          kind: el.hasAttribute("data-snow-text") ? "text" : "card",
          heights: new Float32Array(0),
          contour: new Float32Array(0),
          cap: el.hasAttribute("data-snow-text") ? 11 : 6,
          variant: "",
          width: -1,
          rect: el.getBoundingClientRect(),
          visible: false,
        });
      }
    });
    for (const el of this.surfaces.keys()) if (!found.has(el)) this.surfaces.delete(el);
  }

  private rebuild(s: Surface) {
    const rect = s.rect;
    const bins = Math.max(1, Math.ceil(rect.width / BIN));
    s.width = rect.width;
    s.heights = new Float32Array(bins);
    s.contour = new Float32Array(bins);
    s.variant = s.el.dataset.variant ?? "";

    if (s.kind === "card") {
      const radius = parseFloat(getComputedStyle(s.el).borderTopLeftRadius) || 0;
      for (let i = 0; i < bins; i++) {
        const x = i * BIN + BIN / 2;
        const d = Math.min(x, rect.width - x);
        s.contour[i] = d < radius ? radius - Math.sqrt(Math.max(0, radius * radius - (radius - d) ** 2)) : 0;
        if (d < 2) s.contour[i] = NaN;
      }
      return;
    }

    // Text: rasterise the active glyphs and find the top-most opaque pixel in every column.
    const c = document.createElement("canvas");
    c.width = Math.ceil(rect.width);
    c.height = Math.ceil(rect.height);
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.fillStyle = "#000";
    s.el.querySelectorAll<HTMLElement>("[data-glyph]").forEach((glyph) => {
      if (glyph.dataset.active !== "true") return;
      const r = glyph.getBoundingClientRect();
      const cs = getComputedStyle(glyph);
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = g.measureText(glyph.textContent ?? "");
      const ascent = m.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.9;
      const descent = m.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.25;
      const baseline = r.top - rect.top + (r.height - (ascent + descent)) / 2 + ascent;
      g.fillText(glyph.textContent ?? "", r.left - rect.left, baseline);
    });
    const data = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < bins; i++) {
      let top = NaN;
      for (let x = i * BIN; x < Math.min(c.width, (i + 1) * BIN); x++) {
        for (let y = 0; y < c.height; y++) {
          if (data[(y * c.width + x) * 4 + 3] > 140) {
            if (!(top <= y)) top = y;
            break;
          }
        }
      }
      s.contour[i] = top;
    }
    // Snow can't sit on steep edges: trim bins whose neighbour drops away sharply.
    const trimmed = s.contour.slice();
    for (let i = 0; i < bins; i++) {
      const l = s.contour[i - 1];
      const r = s.contour[i + 1];
      if (isNaN(l) || isNaN(r) || Math.abs(l - s.contour[i]) > 7 || Math.abs(r - s.contour[i]) > 7) trimmed[i] = NaN;
    }
    s.contour = trimmed;
  }

  private shed(s: Surface, fraction: number, budget: { n: number }) {
    for (let i = 0; i < s.heights.length; i++) {
      const h = s.heights[i];
      if (h < 0.4) continue;
      if (budget.n > 0 && Math.random() < 0.25) {
        budget.n--;
        const base = s.rect.top + s.contour[i];
        this.particles.push(this.make(1, "shed", s.rect.left + i * BIN, base - h));
      }
      s.heights[i] = h * (1 - fraction);
    }
  }

  private make(layer: 0 | 1 | 2, kind: Kind, x?: number, y?: number): Particle {
    const p: Particle = {
      x: x ?? Math.random() * this.w,
      y: y ?? -20 - Math.random() * 40,
      py: 0,
      r: 1,
      vx: 0,
      vy: 1,
      phase: Math.random() * Math.PI * 2,
      layer,
      kind,
      alpha: 1,
      life: 0,
    };
    switch (kind) {
      case "flake":
        p.r = [0.8 + Math.random() * 1.1, 1.6 + Math.random() * 1.8, 7 + Math.random() * 9][layer];
        p.vy = [0.35, 0.8, 1.7][layer] * (0.8 + Math.random() * 0.5);
        p.alpha = [0.55, 0.9, 0.45][layer];
        break;
      case "drop":
        p.r = layer === 0 ? 0.6 : 1;
        p.vy = (layer === 0 ? 7 : 12) * (0.8 + Math.random() * 0.4);
        p.alpha = layer === 0 ? 0.25 : 0.45;
        break;
      case "mote":
        p.r = 0.8 + Math.random() * 1.6;
        p.y = y ?? Math.random() * this.h;
        p.vy = (Math.random() - 0.5) * 0.2;
        p.vx = (Math.random() - 0.3) * 0.25;
        p.alpha = 0.25 + Math.random() * 0.4;
        break;
      case "shed":
        p.r = 1.2 + Math.random() * 1.6;
        p.vy = -0.5 - Math.random();
        p.vx = (Math.random() - 0.5) * 1.5;
        p.alpha = 0.95;
        break;
      case "splash":
        p.r = 0.8;
        p.vy = -1 - Math.random() * 1.5;
        p.vx = (Math.random() - 0.5) * 2.5;
        p.alpha = 0.5;
        p.life = 18;
        break;
    }
    p.py = p.y;
    return p;
  }

  private kindFor(layer: 0 | 1 | 2): Kind {
    if (this.mode === "dust") return "mote";
    if (this.mode === "rain" || this.mode === "storm") return layer === 2 ? "flake" : "drop";
    return "flake";
  }

  private target(layer: 0 | 1 | 2) {
    return Math.round(TARGETS[this.mode][layer] * this.intensity * this.density);
  }

  frame(dtMs: number, scrollVelocity: number) {
    const dt = Math.min(dtMs, 50) / 16.67;
    this.t += dt;
    this.dawn = parseFloat(document.documentElement.style.getPropertyValue("--dawn")) || 0;

    // Top up each layer gradually so mode changes cross-fade naturally.
    for (const layer of [0, 1, 2] as const) {
      const missing = this.target(layer) - this.counts[layer];
      for (let i = 0; i < Math.min(missing, 4); i++) {
        const initial = this.particles.length < 30;
        const p = this.make(layer, this.kindFor(layer), undefined, initial ? Math.random() * this.h : undefined);
        this.particles.push(p);
        this.counts[layer]++;
      }
    }

    // Surfaces: measure, rebuild contours if the size or glyph variant changed.
    const budget = { n: MAX_SHED_PER_FRAME };
    const fast = Math.abs(scrollVelocity) > 20;
    const melting = this.mode === "rain" || this.mode === "storm" ? 0.985 : this.mode === "dust" ? 0.997 : 1;
    this.surfaces.forEach((s) => {
      s.rect = s.el.getBoundingClientRect();
      s.visible = s.rect.bottom > -40 && s.rect.top < this.h + 40 && s.rect.width > 0;
      if (!s.visible) return;
      const variant = s.el.dataset.variant ?? "";
      if (variant !== s.variant && s.heights.length) this.shed(s, 1, budget);
      if (Math.abs(s.rect.width - s.width) > 1 || variant !== s.variant) this.rebuild(s);
      if (fast) this.shed(s, 0.35, budget);
      if (melting < 1) for (let i = 0; i < s.heights.length; i++) s.heights[i] *= melting;
      // Relax: tall neighbours slump into short ones, giving soft mounds.
      const h = s.heights;
      for (let i = 1; i < h.length - 1; i++) {
        for (const j of [i - 1, i + 1]) {
          const diff = h[i] - h[j];
          if (diff > 2.2 && !isNaN(s.contour[j])) {
            h[i] -= diff * 0.15;
            h[j] += diff * 0.15;
          }
        }
      }
    });

    const scrollShift = scrollVelocity;
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.py = p.y;
      const depth = DEPTH[p.layer];
      switch (p.kind) {
        case "flake":
          p.y += p.vy * dt;
          p.x += (Math.sin(this.t * 0.02 + p.phase) * 0.5 + this.wind * (0.5 + depth)) * dt;
          break;
        case "drop":
          p.y += p.vy * dt;
          p.x += this.wind * 2.2 * dt;
          break;
        case "mote":
          p.x += (p.vx + Math.sin(this.t * 0.01 + p.phase) * 0.15) * dt;
          p.y += (p.vy + Math.cos(this.t * 0.013 + p.phase) * 0.12) * dt;
          if (p.x < -10) p.x = this.w + 10;
          if (p.x > this.w + 10) p.x = -10;
          if (p.y < -10) p.y = this.h + 10;
          if (p.y > this.h + 10) p.y = -10;
          break;
        case "shed":
          p.vy += 0.12 * dt;
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          break;
        case "splash":
          p.vy += 0.2 * dt;
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          p.life -= dt;
          break;
      }
      if (p.kind !== "mote") p.y -= scrollShift * depth;
      if (p.y < -60 && p.kind !== "mote") p.y += this.h + 80; // scrolled past: wrap

      if (p.layer === 1 && (p.kind === "flake" || p.kind === "drop") && this.collide(p)) {
        if (p.kind === "drop") for (let k = 0; k < 2; k++) next.push(this.make(1, "splash", p.x, p.y));
        this.recycle(p, next);
        continue;
      }

      const gone = p.y > this.h + 30 || p.x < -40 || p.x > this.w + 40 || (p.kind === "splash" && p.life <= 0);
      if (gone) this.recycle(p, next);
      else next.push(p);
    }
    this.particles = next;

    this.fog += (this.fogTarget - this.fog) * 0.02 * dt;
    for (const b of this.fogBlobs) {
      b.x += b.v * dt;
      if (b.x > 1.4) b.x = -0.4;
      if (b.x < -0.4) b.x = 1.4;
    }
    if (this.mode === "storm" && Math.random() < 0.0025 * dt) this.flash = 1;
    this.flash *= 0.86;

    this.draw();
  }

  private recycle(p: Particle, next: Particle[]) {
    if (p.kind === "shed" || p.kind === "splash") return;
    if (this.counts[p.layer] > this.target(p.layer) || p.kind !== this.kindFor(p.layer)) {
      this.counts[p.layer]--;
      return;
    }
    next.push(this.make(p.layer, p.kind));
  }

  private collide(p: Particle): boolean {
    for (const s of this.surfaces.values()) {
      if (!s.visible || p.x < s.rect.left || p.x >= s.rect.right) continue;
      const bin = Math.floor((p.x - s.rect.left) / BIN);
      const off = s.contour[bin];
      if (off === undefined || isNaN(off)) continue;
      const top = s.rect.top + off - s.heights[bin];
      if (p.py <= top + 1 && p.y >= top - 1) {
        if (p.kind === "flake" && Math.random() < 0.85) this.deposit(s, bin, p.r);
        return true;
      }
    }
    return false;
  }

  private deposit(s: Surface, bin: number, r: number) {
    const amount = 0.5 + r * 0.35;
    for (let k = -3; k <= 3; k++) {
      const i = bin + k;
      if (i < 0 || i >= s.heights.length || isNaN(s.contour[i])) continue;
      s.heights[i] = Math.min(s.cap, s.heights[i] + amount * Math.exp(-(k * k) / 4));
    }
  }

  private draw() {
    const { back, front, w, h } = this;
    back.clearRect(0, 0, w, h);
    front.clearRect(0, 0, w, h);

    // On the bright daytime palette pure white disappears, so flakes get a faint cool shadow.
    const day = Math.max(0, (this.dawn - 0.55) / 0.45);

    if (this.fog > 0.01) this.drawFog();

    for (const p of this.particles) {
      const ctx = p.layer === 0 ? back : front;
      if (p.kind === "drop") {
        ctx.strokeStyle = day > 0.3 ? `rgba(80,95,125,${p.alpha})` : `rgba(210,222,245,${p.alpha})`;
        ctx.lineWidth = p.r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - this.wind * 2.2 * 1.6, p.y - p.vy * 1.6);
        ctx.stroke();
        continue;
      }
      if (p.kind === "mote") {
        ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(this.t * 0.05 + p.phase));
        ctx.fillStyle = "rgb(255,226,180)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      if (p.kind === "splash") {
        ctx.fillStyle = day > 0.3 ? "rgba(80,95,125,.5)" : "rgba(220,230,250,.6)";
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
        continue;
      }
      const size = p.r * (p.layer === 2 ? 2.4 : 2.6);
      const img = p.layer === 2 ? this.sprites.soft : this.sprites.sharp;
      if (day > 0 && p.layer !== 2) {
        ctx.globalAlpha = p.alpha * day * 0.55;
        ctx.drawImage(this.sprites.shadow, p.x - size / 2 + 0.6, p.y - size / 2 + 0.8, size, size);
      }
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }

    this.drawSettled(front, day);

    if (this.flash > 0.02) {
      front.fillStyle = `rgba(235,240,255,${this.flash * 0.4})`;
      front.fillRect(0, 0, w, h);
    }
  }

  private drawSettled(ctx: CanvasRenderingContext2D, day: number) {
    this.surfaces.forEach((s) => {
      if (!s.visible) return;
      const { heights, contour, rect } = s;
      let i = 0;
      while (i < heights.length) {
        if (heights[i] < 0.3 || isNaN(contour[i])) {
          i++;
          continue;
        }
        const start = i;
        while (i < heights.length && heights[i] >= 0.3 && !isNaN(contour[i])) i++;
        const end = i - 1;

        const path = new Path2D();
        const x0 = rect.left + start * BIN;
        path.moveTo(x0, rect.top + contour[start] + 0.5);
        for (let k = start; k <= end; k++) {
          path.lineTo(rect.left + k * BIN + BIN / 2, rect.top + contour[k] - heights[k]);
        }
        path.lineTo(rect.left + (end + 1) * BIN, rect.top + contour[end] + 0.5);
        for (let k = end; k >= start; k--) path.lineTo(rect.left + k * BIN + BIN / 2, rect.top + contour[k] + 0.8);
        path.closePath();

        ctx.save();
        ctx.shadowColor = `rgba(${day > 0.3 ? "60,70,100" : "10,20,50"},${0.25 + day * 0.15})`;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "rgba(250,252,255,0.97)";
        ctx.fill(path);
        ctx.restore();
      }
    });
  }

  private drawFog() {
    const { w, h } = this;
    for (const ctx of [this.back, this.front]) {
      const strength = ctx === this.front ? 0.18 : 0.3;
      for (const b of this.fogBlobs) {
        const r = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, r);
        g.addColorStop(0, `rgba(235,238,245,${this.fog * strength})`);
        g.addColorStop(1, "rgba(235,238,245,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }
}
