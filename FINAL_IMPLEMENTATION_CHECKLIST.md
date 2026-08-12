# SUH Sales Pro v6 — Final Implementation Checklist

- Existing localStorage database kept backward compatible.
- Customer records persist; customer saved-rate/product data export added in XLSX and PDF.
- Uploaded product list workbook is bundled as `product_import_template.xlsx` and can auto-load on an empty product master or be loaded manually.
- Product TP/TO scheme history remains supported.
- Invoice search by invoice number and customer added.
- Saved invoices can be loaded, edited and updated.
- Invoice PDF/JPG/WhatsApp export retained.
- Invoice header uses only `SUH` beside logo.
- Invoice watermark uses the SUH logo only.
- Supplied blue SUH stamp and handwritten signature are integrated in the bottom-right Authorized area.
- Scheme module added with customer, product, TP rate, scheme amount, calculated special price, validity dates and saved history.
- `Special Price Offered` PDF output added.
- Sales, SSSAP, outstanding and customer exports use true XLSX output where applicable.
- Existing payments, returns, targets, petrol expense, reports, backup/restore and Android bridge retained.
- Service worker cache upgraded to v6 and includes new invoice assets/product workbook for offline use.
