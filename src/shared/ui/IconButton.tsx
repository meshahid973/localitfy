import type { ComponentPropsWithRef } from "react";
import "./icon-button.css";

type IconButtonProps = ComponentPropsWithRef<"button"> & { "aria-label": string };

/** Shared keyboard, touch and tooltip treatment; feature classes own geometry. */
export function IconButton({ className = "", type = "button", title, ...props }: IconButtonProps) {
  return <button {...props} type={type} className={`ltIconButton ${className}`} title={title ?? props["aria-label"]} />;
}
