import { cn } from "@/lib/utils";

export type ColumnDatum = {
  key: string;
  /** Under the column (only every `labelEvery`th one is shown) */
  axisLabel: string;
  /** In the tooltip and table: "Tue 21 Oct", "8 pm" */
  label: string;
  value: number;
  display: string;
};

/**
 * One series of columns, one hue. Value written on the tallest column only;
 * every column shows its value on hover / keyboard focus, and the same numbers
 * are one tap away as a table.
 */
export function ColumnChart({
  data,
  labelEvery = 1,
  valueHeading,
  labelHeading,
}: {
  data: ColumnDatum[];
  labelEvery?: number;
  valueHeading: string;
  labelHeading: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === max && max > 0);

  return (
    <div className="space-y-3">
      <div className="relative pt-6">
        <div className="flex h-40 items-end gap-0.5 border-b border-border" role="list">
          {data.map((d, i) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0;
            // Keep labels inside the chart near the edges (no sideways scroll on phones)
            const align = i < data.length / 3 ? "left-0" : i >= (data.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div
                key={d.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.label}: ${d.display}`}
                className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
              >
                {/* The whole slot is the hit target; the column is just paint */}
                <span
                  className={cn(
                    "block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80",
                    d.value > 0 && "min-h-[3px]"
                  )}
                  style={{ height: `${pct}%` }}
                />
                {i === peak && (
                  <span className={cn("pointer-events-none absolute -top-6 text-xs font-bold whitespace-nowrap text-foreground group-hover:invisible group-focus-visible:invisible", align)}>
                    {d.display}
                  </span>
                )}
                <span
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-foreground px-2.5 py-1.5 whitespace-nowrap shadow-md group-hover:block group-focus-visible:block",
                    align
                  )}
                >
                  <span className="block text-sm font-bold text-white">{d.display}</span>
                  <span className="block text-xs text-[#ced4da]">{d.label}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {data.map((d, i) => (
            <span key={d.key} className="min-w-0 flex-1 text-center text-xs whitespace-nowrap text-muted-foreground">
              {i % labelEvery === 0 ? d.axisLabel : ""}
            </span>
          ))}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-primary">See as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5 font-semibold">{labelHeading}</th>
              <th className="py-1.5 text-right font-semibold">{valueHeading}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-border last:border-b-0">
                <td className="py-1.5 text-foreground">{d.label}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Ranked horizontal bars: name, bar, value at the tip. */
export function BarList({ rows }: { rows: { key: string; name: string; value: number; display: string; sub?: string }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate font-semibold text-foreground">{r.name}</span>
            <span className="shrink-0 tabular-nums text-foreground">
              {r.display}
              {r.sub && <span className="ml-1.5 text-muted-foreground">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
