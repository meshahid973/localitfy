import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type SurfaceProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Surface<T extends ElementType = "section">({
  as,
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Component = as || "section";

  return (
    <Component className={cx("localtifySurface", className)} {...props}>
      {children}
    </Component>
  );
}

export function SurfaceHeader<T extends ElementType = "header">({
  as,
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Component = as || "header";

  return (
    <Component className={cx("localtifySurfaceHeader", className)} {...props}>
      {children}
    </Component>
  );
}

export function SurfaceActions<T extends ElementType = "div">({
  as,
  className,
  children,
  ...props
}: SurfaceProps<T>) {
  const Component = as || "div";

  return (
    <Component className={cx("localtifySurfaceActions", className)} {...props}>
      {children}
    </Component>
  );
}
