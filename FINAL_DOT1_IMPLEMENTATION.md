# SUH Sales Pro v6.4.1-Dot1 — Final Revision

This Dot1 revision builds on v6.4 and includes the latest locked changes:

- Dashboard Data layout revised: monthly Target section first; separate Achievement Amount/Tonnage with Save and Update buttons; detailed customer/product achievement entry moved below a visual divider.
- Monthly saved Achievement Amount/Tonnage is the dashboard achievement source when present, preventing double counting; detailed entries remain available below for operational history.
- Broadway Pizza section now contains its own PDF/Excel/CSV import. Import automatically updates matching invoices without duplicates and immediately shows a date-filtered preview.
- Broadway date filters (Month, From, To) refresh the preview and keep all matching invoices on one worksheet.
- Broadway export columns: Company Name, Year, Inv.No., Bill No., Date, Party Name, Branch Name, Inv. Amount, Rec Amt, Balance Amt.
- Export title: ATLAS EQUIPMENTS, merged across the report, bold 20 pt.
- Full cell borders, month-specific light header highlight, bold yellow TOTAL row, and #,##0.00 amount formatting.
- Full party name is retained (e.g. J & S Co. (Broadway Pizza)); Year/Invoice/Bill number are written as numeric values when valid to avoid Excel number-as-text warnings.
- Export Excel, Share WhatsApp/Android share chooser, and dedicated Share Gmail option.
- Broadway filename continues to begin with `Broadway Pizza-` and use the selected date/month range.
- Existing v6.4 splash animation, Ayat screen, Dashboard Data foundation, invoice/outstanding functions and bundled product data are preserved.
- Global user-facing/report date standard finalized: DD-MM-YYYY (example 01-08-2026); optional month-name presentation uses DD-MMM-YYYY (example 01-AUG-2026). Internal ISO dates remain only for storage/filter logic.
- Broadway preview and exported one-sheet Date column now explicitly render DD-MM-YYYY.
