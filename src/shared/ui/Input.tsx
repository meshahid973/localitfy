import type { InputHTMLAttributes } from "react";
export type InputProps = InputHTMLAttributes<HTMLInputElement> & { tone?: "default" | "search" };
export function Input({ tone="default", className="", ...props }:InputProps){return <input className={`ltInput ltInput-${tone} ${className}`.trim()} {...props}/>;}
