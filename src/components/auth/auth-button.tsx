import type { ButtonHTMLAttributes, ReactNode } from "react";

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function AuthButton({ children, className = "", ...props }: AuthButtonProps) {
  return (
    <button
      className={`inline-flex h-11 w-full items-center justify-center rounded-xl bg-(--accent) px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(168,97,0,0.16)] transition duration-200 hover:bg-(--accent-strong) active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
