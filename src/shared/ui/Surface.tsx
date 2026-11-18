import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import "./surface.css";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type SurfaceTone = "neutral" | "accent" | "success" | "warning" | "danger";
type SurfaceDensity = "compact" | "normal" | "roomy";
type SurfaceVariant = "transparent" | "fill" | "glass";

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
  tone?: SurfaceTone;
  density?: SurfaceDensity;
  variant?: SurfaceVariant;
  elevated?: boolean;
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Surface<T extends ElementType = "section">({
  as,
  className,
  children,
  tone = "neutral",
  density = "normal",
  variant = "fill",
  elevated = false,
  interactive = false,
  ...props
}: SurfaceProps<T>) {
  const Component = as || "section";

  return (
    <Component
      className={cx(
        "localtifySurface",
        `localtifySurface-${tone}`,
        `localtifySurface-${density}`,
        variant === "transparent" && "localtifySurface-transparent",
        variant === "glass" && "localtifySurface-glass",
        elevated && "localtifySurface-elevated",
        interactive && "localtifySurface-interactive",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function SurfaceHeader<T extends ElementType = "header">({
  as,
  className,
  children,
  density = "normal",
  ...props
}: SurfaceProps<T>) {
  const Component = as || "header";

  return (
    <Component className={cx("localtifySurfaceHeader", `localtifySurfaceHeader-${density}`, className)} {...props}>
      {children}
    </Component>
  );
}

export function SurfaceBody<T extends ElementType = "div">({
  as,
  className,
  children,
  density = "normal",
  ...props
}: SurfaceProps<T>) {
  const Component = as || "div";

  return (
    <Component className={cx("localtifySurfaceBody", `localtifySurfaceBody-${density}`, className)} {...props}>
      {children}
    </Component>
  );
}

export function SurfaceActions<T extends ElementType = "div">({
  as,
  className,
  children,
  density = "normal",
  ...props
}: SurfaceProps<T>) {
  const Component = as || "div";

  return (
    <Component className={cx("localtifySurfaceActions", `localtifySurfaceActions-${density}`, className)} {...props}>
      {children}
    </Component>
  );
}

