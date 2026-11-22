/** Wide registers print on landscape pages. Only on pages that include this. */
export function PrintLandscape() {
  return <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>;
}
