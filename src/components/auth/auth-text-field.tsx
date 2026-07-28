import type { InputHTMLAttributes } from "react";

type AuthTextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AuthTextField({ label, hint, id, className = "", ...props }: AuthTextFieldProps) {
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        id={id}
        className={`h-11 rounded-xl border border-(--line) bg-(--surface-raised) px-3.5 text-sm text-foreground outline-none transition placeholder:text-[#829399] hover:border-[#b7ccca] focus:border-(--accent) focus:ring-2 focus:ring-[#a86100]/20 ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs leading-5 text-(--muted)">{hint}</span> : null}
    </label>
  );
}
