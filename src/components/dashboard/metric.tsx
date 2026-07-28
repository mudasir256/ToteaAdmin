import type { ComponentType } from "react";

type MetricProps = {
  icon: ComponentType<{ size?: number; stroke?: number; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  detail: string;
};

export function Metric({ icon: Icon, label, value, detail }: MetricProps) {
  return (
    <article className="rounded-2xl border border-(--line) bg-(--surface-raised) p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-(--muted)">{label}</p>
        <span className="grid size-8 place-items-center rounded-xl bg-(--surface-tint) text-(--accent)">
          <Icon size={17} stroke={1.8} aria-hidden={true} />
        </span>
      </div>
      <p className="mt-5 font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-(--muted)">{detail}</p>
    </article>
  );
}
