"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

type InViewOptions = NonNullable<Parameters<typeof useInView>[1]>;

type RevealVariant =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "flip-up"
  | "flip-down"
  | "flip-left"
  | "flip-right";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  variant?: RevealVariant;
  distance?: number;
  delay?: number;
  duration?: number;
  once?: boolean;
  margin?: InViewOptions["margin"];
  amount?: InViewOptions["amount"];
};

export default function Reveal({
  children,
  className,
  variant = "slide-up",
  distance = 20,
  delay = 0,
  duration = 0.5,
  once = true,
  margin,
  amount = 0.2,
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once, margin, amount });

  const { initial, animate, style } = getVariant(variant, distance);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={inView ? animate : {}}
      transition={{ duration, delay, ease: "easeOut" }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function getVariant(variant: RevealVariant, d: number) {
  switch (variant) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, style: undefined as React.CSSProperties | undefined };
    case "slide-up":
      return { initial: { y: d, opacity: 0 }, animate: { y: 0, opacity: 1 }, style: undefined };
    case "slide-down":
      return { initial: { y: -d, opacity: 0 }, animate: { y: 0, opacity: 1 }, style: undefined };
    case "slide-left":
      return { initial: { x: d, opacity: 0 }, animate: { x: 0, opacity: 1 }, style: undefined };
    case "slide-right":
      return { initial: { x: -d, opacity: 0 }, animate: { x: 0, opacity: 1 }, style: undefined };
    case "zoom-in":
      return { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, style: undefined };
    case "zoom-out":
      return { initial: { scale: 1.05, opacity: 0 }, animate: { scale: 1, opacity: 1 }, style: undefined };
    case "flip-up":
      return {
        initial: { rotateX: -12, opacity: 0 },
        animate: { rotateX: 0, opacity: 1 },
        style: { perspective: "800px" } as React.CSSProperties,
      };
    case "flip-down":
      return {
        initial: { rotateX: 12, opacity: 0 },
        animate: { rotateX: 0, opacity: 1 },
        style: { perspective: "800px" } as React.CSSProperties,
      };
    case "flip-left":
      return {
        initial: { rotateY: 12, opacity: 0 },
        animate: { rotateY: 0, opacity: 1 },
        style: { perspective: "800px" } as React.CSSProperties,
      };
    case "flip-right":
      return {
        initial: { rotateY: -12, opacity: 0 },
        animate: { rotateY: 0, opacity: 1 },
        style: { perspective: "800px" } as React.CSSProperties,
      };
    default:
      return { initial: { y: d, opacity: 0 }, animate: { y: 0, opacity: 1 }, style: undefined };
  }
}
