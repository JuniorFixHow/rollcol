import type { ReactNode } from "react";

/**
 * A wide register: names stay on the left while the days (or sessions)
 * scroll. Prints on landscape pages.
 */
export function ReportGrid({
  columns,
  totals,
  rows,
}: {
  columns: { key: string; label: ReactNode }[];
  totals: string[];
  rows: { key: string; name: ReactNode; cells: { key: string; value: ReactNode; tone?: "P" | "L" | "A" | "" }[]; totals: ReactNode[] }[];
}) {
  const tone = { P: "text-success", L: "text-warning", A: "bg-danger-soft text-danger", "": "text-muted" };
  return (
    <div className="report-scroll overflow-x-auto rounded-lg border border-line print:overflow-visible print:border-0">
      <table className="w-max min-w-full border-collapse text-sm print:text-[9px]">
        <thead className="bg-surface-muted text-xs text-muted">
          <tr>
            <th scope="col" className="sticky left-0 z-10 min-w-44 bg-surface-muted px-3 py-2 text-left font-medium print:static print:min-w-0">
              Name
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="border-l border-line px-1.5 py-2 text-center font-medium whitespace-nowrap">
                {column.label}
              </th>
            ))}
            {totals.map((label) => (
              <th key={label} scope="col" className="border-l border-line px-2 py-2 text-center font-medium whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-medium whitespace-nowrap print:static">
                {row.name}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.key} className={`border-l border-line px-1.5 py-1.5 text-center font-semibold ${tone[cell.tone ?? ""]}`}>
                  {cell.value}
                </td>
              ))}
              {row.totals.map((value, index) => (
                <td key={index} className="border-l border-line px-2 py-1.5 text-center whitespace-nowrap">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
