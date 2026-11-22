import { PrintButton } from "@/components/print-button";
import { buttonClass } from "@/components/ui";

/** Excel, CSV and print, for a report page. `href` is the export route without a format. */
export function ReportDownloads({ href, print = true }: { href: string; print?: boolean }) {
  const join = href.includes("?") ? "&" : "?";
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {/* Plain links: these are file downloads, not pages. */}
      <a href={`${href}${join}format=xlsx`} className={buttonClass("primary", "sm")} download>
        Download Excel
      </a>
      <a href={`${href}${join}format=csv`} className={buttonClass("secondary", "sm")} download>
        Download CSV
      </a>
      {print ? <PrintButton /> : null}
    </div>
  );
}
