import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import "./surface.css";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type SurfaceTone = "neutral" | "accent" | "success" | "warning" | "danger";
type SurfaceDensity = "compact" | "normal" | "roomy";

type SurfaceBaseProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
  density?: SurfaceDensity;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

type SurfaceProps<T extends ElementType> = SurfaceBaseProps<T> & {
  tone?: SurfaceTone;
  elevated?: boolean;
  interactive?: boolean;
};

export function Surface<T extends ElementType = "section">({
  as,
  className,
  children,
  tone = "neutral",
  density = "normal",
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
}: SurfaceBaseProps<T>) {
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
}: SurfaceBaseProps<T>) {
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
}: SurfaceBaseProps<T>) {
  const Component = as || "div";

  return (
    <Component className={cx("localtifySurfaceActions", `localtifySurfaceActions-${density}`, className)} {...props}>
      {children}
    </Component>
  );
}
