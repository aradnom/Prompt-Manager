import { useEffect, useRef } from "react";
import { useScroll } from "@/contexts/ScrollContext";

/**
 * ConstellationBackground
 *
 * A canvas-based animated background inspired by a deep-space night sky.
 * Features:
 *   - Static field of fine background stars (drawn once to an offscreen canvas)
 *   - Floating constellation particles that slowly drift, fade in, and fade out
 *   - Connecting lines between nearby particles forming constellation shapes
 *   - Radial horizon glow at the bottom (magenta → purple → transparent)
 *   - Rare shooting stars that streak across the upper sky
 *   - Very rare subtle supernova flashes with expanding rings
 *
 * Replaces <ParallaxCircleMenuRandom /> in Layout.tsx.
 * Colors are matched to the project's CSS theme variables.
 */

// ─── Theme colors (matched to index.css @theme) ───────────────────────────
const CYAN = "0,229,255"; // brighter than --color-cyan-light for glow
const MAGENTA = "246,59,110"; // --color-magenta-light
const PURPLE = "180,100,255"; // mid-range purple accent
const BG = "15,5,53"; // --color-background (#0f0535)

type ParticleHue = "cyan" | "magenta" | "purple";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: ParticleHue;
  life: number;
  maxLife: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
  hue: "white" | "cyan" | "magenta";
}

interface Supernova {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  hue: "cyan" | "magenta" | "white";
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const randHue = (): ParticleHue => {
  const r = Math.random();
  return r < 0.33 ? "cyan" : r < 0.66 ? "magenta" : "purple";
};

const colorOf = (hue: ParticleHue, a: number): string => {
  const rgb = hue === "cyan" ? CYAN : hue === "magenta" ? MAGENTA : PURPLE;
  return `rgba(${rgb},${a})`;
};

/** Ease in/out for particle life: fade first 15%, fade last 15% */
const lifeAlpha = (life: number): number => {
  if (life < 0.15) return life / 0.15;
  if (life > 0.85) return (1 - life) / 0.15;
  return 1;
};

const spawnParticle = (w: number, h: number): Particle => ({
  x: Math.random() * w,
  y: Math.random() * h,
  vx: (Math.random() - 0.5) * 0.0875,
  vy: (Math.random() - 0.5) * 0.0875,
  r: (Math.random() * 1.8 + 0.5) * 0.8,
  hue: randHue(),
  life: Math.random(),
  maxLife: 900 + Math.random() * 700,
});

const spawnShootingStar = (w: number, h: number): ShootingStar => ({
  x: Math.random() * w * 0.8 + w * 0.1,
  y: Math.random() * h * 0.45,
  vx: 3.5 + Math.random() * 2.5,
  vy: 1.8 + Math.random() * 1.4,
  life: 0,
  maxLife: 55 + Math.random() * 35,
  len: 45 + Math.random() * 30,
  hue: Math.random() < 0.6 ? "white" : Math.random() < 0.5 ? "cyan" : "magenta",
});

const spawnSupernova = (w: number, h: number): Supernova => ({
  x: Math.random() * w * 0.8 + w * 0.1,
  y: Math.random() * h * 0.55 + h * 0.05,
  life: 0,
  maxLife: 280 + Math.random() * 160,
  hue: Math.random() < 0.5 ? "cyan" : Math.random() < 0.5 ? "magenta" : "white",
});

// ─── Component ────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 60;
const STAR_COUNT = 220;
const CONNECTION_DISTANCE = 140;

export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollY } = useScroll();
  const targetOffsetRef = useRef(0);

  useEffect(() => {
    targetOffsetRef.current = scrollY * 0.05;
  }, [scrollY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Resize ─────────────────────────────────────────────────────────
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const W = () => canvas.width;
    const H = () => canvas.height;

    // ── Background star field (static, offscreen) ───────────────────────
    const starCanvas = document.createElement("canvas");
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
    const sctx = starCanvas.getContext("2d")!;

    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      r: Math.random() * 0.63 + 0.1,
      a: (Math.random() * 0.5 + 0.15) * 0.75,
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? "c" : "m") : "w",
    }));

    const drawStars = (
      sc: CanvasRenderingContext2D,
      sw: number,
      sh: number,
    ) => {
      sc.clearRect(0, 0, sw, sh);
      stars.forEach((s) => {
        sc.beginPath();
        sc.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        sc.fillStyle =
          s.hue === "c"
            ? `rgba(160,240,255,${s.a})`
            : s.hue === "m"
              ? `rgba(255,160,220,${s.a})`
              : `rgba(255,255,255,${s.a})`;
        sc.fill();
      });
    };

    drawStars(sctx, starCanvas.width, starCanvas.height);

    // ── Particles ───────────────────────────────────────────────────────
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () =>
      spawnParticle(window.innerWidth, window.innerHeight),
    );

    // ── Shooting stars ──────────────────────────────────────────────────
    const shootingStars: ShootingStar[] = [];
    let nextShoot = 900 + Math.random() * 600;

    // ── Supernovae ──────────────────────────────────────────────────────
    const supernovae: Supernova[] = [];
    let nextNova = 1800 + Math.random() * 1620;

    // ── Draw loop ───────────────────────────────────────────────────────
    let rafId: number;
    let currentOffset = 0;

    const draw = () => {
      const cW = W();
      const cH = H();

      // Rebuild star canvas on resize
      if (starCanvas.width !== cW || starCanvas.height !== cH) {
        starCanvas.width = cW;
        starCanvas.height = cH;
        stars.forEach((s) => {
          s.x = Math.random() * cW;
          s.y = Math.random() * cH;
        });
        drawStars(sctx, cW, cH);
      }

      // Trail fade (full viewport, no parallax)
      ctx.fillStyle = `rgba(${BG},0.18)`;
      ctx.fillRect(0, 0, cW, cH);

      // Ease current offset toward target for "sky drift" after scroll stops
      currentOffset += (targetOffsetRef.current - currentOffset) * 0.08;

      // Parallax: offset all sky elements upward as user scrolls
      ctx.save();
      ctx.translate(0, -currentOffset);

      // Static star field
      ctx.drawImage(starCanvas, 0, 0);

      // Sky darkening toward top
      const topGrd = ctx.createLinearGradient(0, 0, 0, cH * 0.4);
      topGrd.addColorStop(0, "rgba(5,2,15,0.35)");
      topGrd.addColorStop(1, "transparent");
      ctx.fillStyle = topGrd;
      ctx.fillRect(0, 0, cW, cH * 0.4);

      // ── Age + move particles ───────────────────────────────────────
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = cW;
        if (p.x > cW) p.x = 0;
        if (p.y < 0) p.y = cH;
        if (p.y > cH) p.y = 0;
        p.life += 1 / p.maxLife;
        if (p.life >= 1) {
          p.x = Math.random() * cW;
          p.y = Math.random() * cH;
          p.vx = (Math.random() - 0.5) * 0.0875;
          p.vy = (Math.random() - 0.5) * 0.0875;
          p.life = 0;
          p.maxLife = 900 + Math.random() * 700;
          p.hue = randHue();
        }
      });

      // ── Constellation lines ────────────────────────────────────────
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const la = Math.min(
              lifeAlpha(particles[i].life),
              lifeAlpha(particles[j].life),
            );
            const a = (1 - dist / CONNECTION_DISTANCE) * 0.25 * la;
            const grd = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y,
            );
            grd.addColorStop(0, colorOf(particles[i].hue, a));
            grd.addColorStop(1, colorOf(particles[j].hue, a));
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // ── Particle dots ──────────────────────────────────────────────
      particles.forEach((p) => {
        const la = lifeAlpha(p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = colorOf(p.hue, 0.9 * la);
        ctx.shadowBlur = 8;
        ctx.shadowColor = colorOf(p.hue, 0.6 * la);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ── Shooting stars ─────────────────────────────────────────────
      nextShoot--;
      if (nextShoot <= 0) {
        shootingStars.push(spawnShootingStar(cW, cH));
        if (Math.random() < 0.25) shootingStars.push(spawnShootingStar(cW, cH));
        nextShoot = 900 + Math.random() * 600;
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.life++;
        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1);
          continue;
        }

        const prog = s.life / s.maxLife;
        const ease = 1 - prog * prog;
        const alpha = ease * 0.595;
        const hx = s.x + s.vx * s.life;
        const hy = s.y + s.vy * s.life;
        const spd = Math.hypot(s.vx, s.vy);
        const tx = hx - (s.vx / spd) * s.len * ease;
        const ty = hy - (s.vy / spd) * s.len * ease;

        const sg = ctx.createLinearGradient(tx, ty, hx, hy);
        const col =
          s.hue === "cyan"
            ? "0,229,255"
            : s.hue === "magenta"
              ? "255,45,155"
              : "220,210,255";
        sg.addColorStop(0, `rgba(${col},0)`);
        sg.addColorStop(0.7, `rgba(${col},${alpha * 0.4})`);
        sg.addColorStop(1, `rgba(${col},${alpha})`);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.strokeStyle = sg;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hx, hy, 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col},${alpha})`;
        ctx.fill();
      }

      // ── Supernovae ─────────────────────────────────────────────────
      nextNova--;
      if (nextNova <= 0) {
        supernovae.push(spawnSupernova(cW, cH));
        nextNova = 1800 + Math.random() * 1620;
      }

      for (let i = supernovae.length - 1; i >= 0; i--) {
        const n = supernovae[i];
        n.life++;
        if (n.life >= n.maxLife) {
          supernovae.splice(i, 1);
          continue;
        }

        const prog = n.life / n.maxLife;
        const col =
          n.hue === "cyan"
            ? "0,229,255"
            : n.hue === "magenta"
              ? "255,45,155"
              : "220,200,255";

        // Phase 1 (0–12%): bright flash
        if (prog < 0.12) {
          const fp = prog / 0.12;
          const fr = fp * 10;
          const fa = (1 - fp) * 0.175;
          const fg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, fr);
          fg.addColorStop(0, `rgba(${col},${fa})`);
          fg.addColorStop(1, "transparent");
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(n.x, n.y, fr, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(n.x, n.y, 1.5 * (1 - fp * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(1 - fp) * 0.225})`;
          ctx.fill();
        }

        // Phase 2 (12–100%): expanding ring
        const rp = Math.max(0, (prog - 0.12) / 0.88);
        const ringR = rp * 28;
        const ringA = (1 - rp) * 0.055;
        if (ringA > 0.005) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${col},${ringA})`;
          ctx.lineWidth = 1 + (1 - rp) * 1.5;
          ctx.stroke();

          const ng = ctx.createRadialGradient(
            n.x,
            n.y,
            ringR * 0.6,
            n.x,
            n.y,
            ringR * 1.4,
          );
          ng.addColorStop(0, "transparent");
          ng.addColorStop(0.5, `rgba(${col},${ringA * 0.3})`);
          ng.addColorStop(1, "transparent");
          ctx.fillStyle = ng;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Horizon glow — radial gradient anchored to viewport bottom (no parallax)
      const hgrd = ctx.createRadialGradient(
        cW * 0.5,
        cH * 1.5,
        0,
        cW * 0.5,
        cH * 1.5,
        cH * 1.35,
      );
      hgrd.addColorStop(0, "rgba(200,40,180,0.15)");
      hgrd.addColorStop(0.15, "rgba(160,40,220,0.12)");
      hgrd.addColorStop(0.45, "rgba(120,30,200,0.06)");
      hgrd.addColorStop(0.75, "rgba(80,20,160,0.0225)");
      hgrd.addColorStop(1, "transparent");
      ctx.fillStyle = hgrd;
      ctx.fillRect(0, 0, cW, cH);

      rafId = requestAnimationFrame(draw);
    };

    // Initial clear before first frame
    ctx.fillStyle = `rgb(${BG})`;
    ctx.fillRect(0, 0, W(), H());
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
