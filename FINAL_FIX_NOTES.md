# SUH Sales Pro v6.2 — Final Corrections

- Product master now seeds directly from the supplied Excel workbook inside app code, so it does not depend on WebView fetching/parsing the XLSX at startup.
- All 72 spreadsheet rows are bundled in the seed. The source workbook contains duplicate Product Code 5632 twice; both rows are retained internally with separate IDs while the displayed SKU code stays 5632.
- TP price, TO scheme, carton size, carton weight/derived weight and unit are populated from the supplied sheet.
- Invoice Discount, Any Charges and Previous Balance are manual optional fields.
- If an optional amount is blank or 0, that row is omitted from PDF/JPG/WhatsApp invoice output.
- If any optional amount is entered, Net Amount is recalculated: Sub Total - Discount + Any Charges + Previous Balance.
- Without any optional amount, the invoice summary prints only Net Amount.
- Authorized signature has been removed completely. Only the supplied blue SUH stamp is printed.
- Watermark is a transparent light-gray SUH emblem extracted from the stamp artwork; no square/white box is used.
- Android native PDF/JPG/share generator and browser fallback generator use the same invoice rules.
- Android app version bumped to 6.2 (versionCode 8).
