/**
 * The printed (and "Save as PDF") version of a report: only the school, the
 * report's title and dates, and the table. The screen version is hidden when
 * printing, and this one is hidden on screen.
 */
export interface PrintTable {
  title?: string;
  headers: string[];
  /** Columns from this index on are centred (marks and totals). */
  centreFrom: number;
  rows: { key: string; cells: string[]; flag?: boolean }[];
}

const MARK_TONE: Record<string, string> = {
  P: "#d7efdf",
  "P*": "#d7efdf",
  L: "#fbecc8",
  A: "#f7d4d4",
};

export function PrintReport({
  school,
  title,
  period,
  tables,
  notes,
}: {
  school: string;
  title: string;
  period: string;
  tables: PrintTable[];
  notes: string[];
}) {
  const printed = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" }).format(new Date());
  return (
    <div className="print-report hidden text-black print:block">
      <header className="mb-4 flex items-end justify-between gap-6 border-b border-black/30 pb-2">
        <div>
          <p className="text-[11px] tracking-wide uppercase">{school}</p>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-[11px]">{period}</p>
        </div>
        <p className="text-right text-[10px]">Printed {printed}</p>
      </header>
      {tables.map((table) => (
        <section key={table.title ?? "main"} className="mb-5 break-inside-auto">
          {table.title ? <h2 className="mb-1 text-[12px] font-semibold">{table.title}</h2> : null}
          <table className="w-full border-collapse text-[9px] leading-tight">
            <thead>
              <tr>
                {table.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className={`border border-black/40 bg-black/5 px-1 py-1 font-semibold ${index >= table.centreFrom ? "text-center" : "text-left"}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.key} className="break-inside-avoid">
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.key}-${index}`}
                      style={index >= table.centreFrom && MARK_TONE[cell] ? { backgroundColor: MARK_TONE[cell] } : undefined}
                      className={`border border-black/30 px-1 py-[3px] ${index >= table.centreFrom ? "text-center" : ""} ${
                        row.flag && index === row.cells.length - 1 ? "font-semibold" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {notes.map((note) => (
        <p key={note} className="text-[9px]">
          {note}
        </p>
      ))}
    </div>
  );
}
