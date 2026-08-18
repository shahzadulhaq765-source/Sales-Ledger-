# SUH Sales Pro v6.4 — Finalized Revision

Implemented on the user-provided latest SUH source.

- Dashboard: removed Top Customers, Recent Invoices and dashboard Delivery Status panels.
- Dashboard six KPI values now use Dashboard Data only: Target/Achievement/Remaining Amount and Target/Achievement/Remaining Tonnage.
- Dashboard Data: monthly/effective targets, manual achievement entry by customer/SKU/cartons, product/customer auto-fill, TP/carton weight calculations, Excel/CSV import, history, delete/correct, last-update timestamp, manual recalculate.
- Existing invoice/sales data no longer feeds the six target/achievement/remaining dashboard figures.
- Startup: approved black/gold distribution-office energy sequence (~8 sec).
- Second startup screen: Surah At-Talaq 65:2–3 Arabic + Urdu translation with progressive typing and 15-second reading hold, then smooth app transition.
- Invoice-wise Outstanding: separate module, Excel/CSV/PDF import, preview, duplicate invoice update protection, saved totals/search/history. PDF parser is optimized for the supplied Atlas SB Inv.Wise Outstanding report and parses its Flate-compressed text streams locally/offline.
- Broadway Pizza: month/from/to selection, preview, one-sheet landscape XLSX, file name begins `Broadway Pizza-`, Bill No = Year + Inv.No., exact invoice/received/balance totals, Android save and WhatsApp/share flow.
- Product master remains the bundled 72-row source list and existing app data/backup behavior is preserved.
- Invoice native PDF/JPG behavior preserved: optional Discount/Any Charges/Previous Balance only render when > 0; stamp-only authorized area remains.
