"use client";

import * as React from "react";
import { cn } from "./ui";

export type GridProps = {
  className?: string;
  density?: number;
  baseRadius?: number;
  hoverBoost?: number;
  influenceRadius?: number;
  fadeStop?: string;
  followDamping?: number;
  alphaLight?: number;
  alphaDark?: number;
  darkGlow?: number;
};

export default function DottedRadialGridCanvas({
  className,
  density = 24,
  baseRadius = 1.6,
  hoverBoost = 2.25,
  influenceRadius = 190,
  fadeStop = "76%",
  followDamping = 0.16,
  alphaLight = 0.24,
  alphaDark = 0.45,
  darkGlow = 0.8,
}: GridProps) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const mouseTarget = React.useRef<{ x: number; y: number; inside: boolean }>({
    x: 0,
    y: 0,
    inside: false,
  });
  const mouseRender = React.useRef<{ x: number; y: number; inside: boolean }>({
    x: 0,
    y: 0,
    inside: false,
  });

  const pointsRef = React.useRef<Array<{ x: number; y: number }>>([]);
  const sizeRef = React.useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  React.useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    let disposed = false;

    const isDark = () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      sizeRef.current = { w: Math.round(rect.width), h: Math.round(rect.height), dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const pts: Array<{ x: number; y: number }> = [];
      const step = density;
      const xCount = Math.ceil(rect.width / step) + 2;
      const yCount = Math.ceil(rect.height / step) + 2;
      const xOffset = ((rect.width % step) / 2) - step;
      const yOffset = ((rect.height % step) / 2) - step;

      for (let iy = 0; iy < yCount; iy++) {
        for (let ix = 0; ix < xCount; ix++) {
          pts.push({ x: xOffset + ix * step, y: yOffset + iy * step });
        }
      }
      pointsRef.current = pts;
    };

    const getFillStyle = () => {
      const c = getComputedStyle(wrap).color;
      const m = c.match(/rgba?\(([^)]+)\)/);
      const [r, g, b] = m ? m[1].split(",").slice(0, 3).map((v) => parseFloat(v)) : [0, 0, 0];
      const a = isDark() ? alphaDark : alphaLight;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    const onMove = (ev: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      mouseTarget.current.x = x;
      mouseTarget.current.y = y;
      mouseTarget.current.inside = inside;
    };
    const onLeaveWindow = () => {
      mouseTarget.current.inside = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeaveWindow, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {})
        : null;
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    resize();

    const sigma = influenceRadius;
    const twoSigmaSq = 2 * sigma * sigma;

    const tick = () => {
      if (disposed) return;

      const { w, h, dpr } = sizeRef.current;

      mouseRender.current.x = lerp(mouseRender.current.x, mouseTarget.current.x, followDamping);
      mouseRender.current.y = lerp(mouseRender.current.y, mouseTarget.current.y, followDamping);
      mouseRender.current.inside = mouseTarget.current.inside;

      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = getFillStyle();

      if (isDark() && darkGlow > 0) {
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = darkGlow;
      } else {
        ctx.shadowBlur = 0;
      }

      const r0 = baseRadius;
      const boost = hoverBoost;
      const mx = mouseRender.current.x;
      const my = mouseRender.current.y;
      const active = mouseRender.current.inside;

      for (let i = 0; i < pointsRef.current.length; i++) {
        const p = pointsRef.current[i];
        let r = r0;

        if (active) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          const influence = Math.exp(-d2 / twoSigmaSq);
          r = r0 * (1 + (boost - 1) * influence);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeaveWindow);
      window.removeEventListener("resize", resize);
      mo?.disconnect();
    };
  }, [density, baseRadius, hoverBoost, influenceRadius, followDamping, alphaLight, alphaDark, darkGlow]);

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `radial-gradient(ellipse at center, black, transparent ${fadeStop})`,
    maskImage: `radial-gradient(ellipse at center, black, transparent ${fadeStop})`,
  };

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", "text-black dark:text-white", className)}
      style={maskStyle}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
