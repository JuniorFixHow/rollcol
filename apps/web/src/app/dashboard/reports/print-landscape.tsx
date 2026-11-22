/**
 * Report pages print on landscape A4. The page margin is 0 so browsers leave
 * out their own header and footer (page title, address, date); the report
 * keeps its own margin instead (see PrintReport).
 */
export function PrintLandscape() {
  return <style>{"@page { size: A4 landscape; margin: 0; }"}</style>;
}
