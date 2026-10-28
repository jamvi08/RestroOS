import Link from "next/link";
import { cn } from "@/lib/utils";

/** Date-range presets as links (?range=…), in one row above everything they filter. */
export function RangeTabs({
  options,
  current,
  basePath,
}: {
  options: { value: string; label: string }[];
  current: string;
  basePath: string;
}) {
  return (
    <nav aria-label="Date range" className="hide-scrollbar flex gap-2 overflow-x-auto">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={`${basePath}?range=${o.value}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full border-[1.5px] px-4 text-[15px] font-semibold transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:border-primary"
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Reads ?range= against the allowed values, falling back to the first. */
export function pickRange<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T {
  return allowed.includes(raw as T) ? (raw as T) : allowed[0];
}
