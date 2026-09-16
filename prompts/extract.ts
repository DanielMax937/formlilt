import type { ParsedDocument } from '@/lib/pdf-extract';
import { uniqueAcro } from '@/lib/compact-extract';
export function extractPrompt(doc: ParsedDocument): string {
  const pages = doc.pages.map(({ textItems, ...page }) => ({
    ...page,
    text: textItems.map((t, i) => [
      i,
      t.str,
      +t.x.toFixed(1),
      +t.y.toFixed(1),
      +t.w.toFixed(1),
      +t.h.toFixed(1),
    ]),
  }));
  const acro = uniqueAcro(doc).map((f, i) => ({
    i,
    page: f.page,
    type: f.type,
    box: f.bbox.map((v) => +v.toFixed(4)),
    ...(f.options ? { options: f.options } : {}),
  }));
  return `Extract EVERY fillable blank, checkbox, and signature. Use compact rows to reference the numbered source. Return JSON only. Do not use tools. No prose or analysis in output.
Rows have EXACTLY these 13 positions:
[label, type, required, sectionIndex, pageIndex, acroIndex, textItemIndex, bbox, options, dependsOnRowIndex, dependencyValue, helpTextIndices, constraints]
Indices are ZERO-based. Use -1 for missing acro, text, dependency, signature/date/name references. Use [] for no box/options/help. Use "" for no dependency value. Use null for no constraints. label is a concise human-friendly name. sections is a list of section titles in reading order. Every field references one section.
For each distinct AcroForm index return exactly ONE row using that index. Native options are filled by the server; options may be []. Include non-AcroForm signature/date blanks visible in the image as extra rows. Every non-AcroForm text-page row must reference its nearest true label's textItemIndex. Do not invent text indices. A repeated table cell may reference its column header and must have its own bbox. Each table cell counts as a separate field, including repeated empty rows. Do not combine separate boxes into one textarea. Exclude office-use-only and notary-only fields; keep prescriber fields optional with help explaining who completes them.
Bbox is [left,top,right,bottom] of the BLANK INPUT AREA, normalized 0..1 with TOP-LEFT origin. Supply bbox for every non-AcroForm row. acro rows may use []. Rows for empty table cells use bbox for that cell, textItemIndex for the column heading. For scan pages use bbox and -1 textItemIndex. Checkbox bbox must cover the checkbox square, not the caption. Values must have positive width/height.
Types: text,number,date,email,phone,select,multiselect,checkbox,signature,textarea. Signatures use signature. Preserve native choice values. Use dependencies for conditional sections (e.g. other insurance). Use individual checkbox rows for separate boxes without a native radio group. required only where applicable, keep unused repeated table rows optional. Never mark physician/notary signatures required for a parent/patient. Fields requiring another person's signature remain blank unless that person signs. All names/IDs are strings. For dates, preserve an explicit format printed in the form (including localized day/month/year hints). When no date format is printed, use YYYY-MM-DD to avoid assuming a month/day order. helpTextIndices quote only short relevant actual instructions on the same page. No invented advice.
At root signature/date/name are row indices for the primary user's signature, associated signed date and full name if identifiable; otherwise -1.
At root exclusiveGroups is a list of checkbox-row index groups where the form permits at most one checked option (e.g. a Yes/No pair or a choice of residence type). Use [] when none. Include all alternatives in each group; do not group independent check-all-that-apply boxes. Do not include native radio/select rows, whose options are already exclusive.
source=${doc.source}. Text tuples are [index,string,x,y,width,height] in displayed page points. Acro indices identify actual widgets. Match their rectangles to image/text labels.
<form_text>${JSON.stringify({ pages, acro })}</form_text>`;
}
