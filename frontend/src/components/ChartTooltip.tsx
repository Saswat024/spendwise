import { formatMoney } from "@/lib/types";

export function formatCompactCurrency(v: number): string {
  if (v === 0) return "₹0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10000000) {
    const val = abs / 10000000;
    return `${sign}₹${val.toFixed(val % 1 === 0 ? 0 : 1)}Cr`;
  }
  if (abs >= 100000) {
    const val = abs / 100000;
    return `${sign}₹${val.toFixed(val % 1 === 0 ? 0 : 1)}L`;
  }
  if (abs >= 1000) {
    const val = abs / 1000;
    return `${sign}₹${val.toFixed(val % 1 === 0 ? 0 : 1)}k`;
  }
  return `${sign}₹${abs}`;
}

export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
  dataKey?: string;
}

export function CustomChartTooltip({
  active,
  payload,
  label,
  formatter = formatMoney,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  formatter?: (val: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
      {label !== undefined && label !== "" && (
        <p className="font-semibold text-card-foreground mb-1.5">{label}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, idx) => {
          const val = typeof entry.value === "number" ? formatter(entry.value) : entry.value;
          const rawName = entry.name ?? entry.dataKey ?? "Total";
          const displayName =
            rawName.toLowerCase() === "total"
              ? "Total"
              : rawName.charAt(0).toUpperCase() + rawName.slice(1);
          return (
            <div key={idx} className="flex items-center justify-between gap-4 min-w-32">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.fill || "var(--chart-1)" }}
                />
                <span>{displayName}:</span>
              </div>
              <span className="font-mono font-semibold text-card-foreground">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
