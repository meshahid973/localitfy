import type { ButtonHTMLAttributes, ReactNode } from "react";
export type ButtonVariant = "primary" | "soft" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; children?: ReactNode };
export function Button({ variant="soft", size="md", className="", type="button", children, ...props }:ButtonProps){return <button type={type} className={`ltButton ltButton-${variant} ltButton-${size} ${className}`.trim()} {...props}>{children}</button>;}
