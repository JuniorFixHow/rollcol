/** The report views live in the shared package, so the app uses the same rules. */
export {
  type ReportQuery as Query,
  type ReportView,
  addDays,
  inView,
  mondayOf,
  parseView,
  rangeLabel,
  todayIso,
  viewLabel,
  viewQuery,
  weekColumns,
} from "@rollcol/shared";
