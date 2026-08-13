package com.suh.salespro

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.text.DecimalFormat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequestCode = 7341
    private val appUrl = "file:///android_asset/index.html"
    private val money = DecimalFormat("#,##0.00")

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.addJavascriptInterface(AndroidBridge(), "SUHAndroid")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    startActivityForResult(params?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"
                    }, fileChooserRequestCode)
                    true
                } catch (e: Exception) {
                    filePathCallback = null
                    Toast.makeText(this@MainActivity, "File picker could not open", Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "file" && uri.path?.startsWith("/android_asset/") == true) false else {
                    try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
                    true
                }
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("http://") || url.startsWith("https://")) {
                try {
                    val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    val request = DownloadManager.Request(Uri.parse(url)).setMimeType(mimeType)
                        .addRequestHeader("User-Agent", userAgent)
                        .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                        .setTitle(fileName).setDescription("SUH Sales Pro download")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                } catch (_: Exception) { Toast.makeText(this, "Download could not start", Toast.LENGTH_SHORT).show() }
            }
        }
        if (savedInstanceState == null) webView.loadUrl(appUrl)
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun saveBase64(fileName: String, mimeType: String, base64Data: String) {
            Thread {
                try {
                    saveToDownloads(fileName, mimeType, Base64.decode(base64Data, Base64.DEFAULT))
                    uiToast("$fileName saved in Downloads/SUH Sales Pro")
                } catch (_: Exception) { uiToast("Could not save $fileName") }
            }.start()
        }

        @JavascriptInterface
        fun shareBase64(fileName: String, mimeType: String, base64Data: String) {
            Thread {
                try { shareBytes(fileName, mimeType, Base64.decode(base64Data, Base64.DEFAULT)) }
                catch (_: Exception) { uiToast("Could not share file") }
            }.start()
        }

        @JavascriptInterface
        fun saveInvoicePdf(invoiceJson: String) {
            Thread {
                try {
                    val obj = JSONObject(invoiceJson)
                    val bytes = buildInvoicePdf(obj)
                    val name = invoiceName(obj, "pdf")
                    saveToDownloads(name, "application/pdf", bytes)
                    uiToast("Invoice PDF saved in Downloads/SUH Sales Pro")
                } catch (e: Exception) { uiToast("Invoice PDF could not be saved") }
            }.start()
        }

        @JavascriptInterface
        fun saveInvoiceJpg(invoiceJson: String) {
            Thread {
                try {
                    val obj = JSONObject(invoiceJson)
                    val bitmap = drawInvoice(obj)
                    val out = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 94, out)
                    saveToDownloads(invoiceName(obj, "jpg"), "image/jpeg", out.toByteArray())
                    bitmap.recycle()
                    uiToast("Invoice JPG saved in Downloads/SUH Sales Pro")
                } catch (_: Exception) { uiToast("Invoice JPG could not be saved") }
            }.start()
        }

        @JavascriptInterface
        fun shareInvoicePdf(invoiceJson: String) {
            Thread {
                try {
                    val obj = JSONObject(invoiceJson)
                    shareBytes(invoiceName(obj, "pdf"), "application/pdf", buildInvoicePdf(obj))
                } catch (_: Exception) { uiToast("Invoice could not be shared") }
            }.start()
        }
    }

    private fun invoiceName(obj: JSONObject, ext: String): String {
        val safe = obj.optString("invoiceNo", "invoice").replace(Regex("[^A-Za-z0-9_-]"), "-")
        return "SUH-Invoice-$safe.$ext"
    }

    private fun buildInvoicePdf(obj: JSONObject): ByteArray {
        val bitmap = drawInvoice(obj)
        val pdf = PdfDocument()
        val page = pdf.startPage(PdfDocument.PageInfo.Builder(595, 842, 1).create())
        page.canvas.drawBitmap(bitmap, null, RectF(0f, 0f, 595f, 842f), Paint(Paint.ANTI_ALIAS_FLAG))
        pdf.finishPage(page)
        val out = ByteArrayOutputStream()
        pdf.writeTo(out)
        pdf.close(); bitmap.recycle()
        return out.toByteArray()
    }

    private fun drawInvoice(obj: JSONObject): Bitmap {
        val w = 1240; val h = 1754
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bitmap)
        c.drawColor(Color.WHITE)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        fun text(s: String, x: Float, y: Float, size: Float, bold: Boolean = false, color: Int = Color.rgb(16,16,16), align: Paint.Align = Paint.Align.LEFT) {
            p.color = color; p.textSize = size; p.typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT; p.textAlign = align
            c.drawText(s, x, y, p)
        }
        fun assetBitmap(path: String): Bitmap? = try { assets.open(path).use { BitmapFactory.decodeStream(it) } } catch (_: Exception) { null }
        val yellow = Color.rgb(255, 212, 0); val muted = Color.rgb(85,85,85)

        val logo = assetBitmap("assets/suh-final-logo.png")
        logo?.let {
            p.alpha = 18; c.drawBitmap(it, null, RectF(295f, 545f, 945f, 1195f), p); p.alpha = 255
            c.drawBitmap(it, null, RectF(85f, 58f, 190f, 163f), p)
        }
        text("SUH", 215f, 98f, 36f, true); text("Sales & Distribution Invoice", 215f, 128f, 18f)
        p.color = yellow; c.drawRect(70f,185f,860f,219f,p); c.drawRect(1090f,185f,1170f,219f,p)
        text("INVOICE",895f,216f,38f,true)
        text("Code:",110f,280f,18f,true); text("Name:",110f,316f,18f,true); text("Address:",110f,352f,18f,true)
        text(obj.optString("customerCode"),205f,280f,18f); text(obj.optString("customerName"),205f,316f,18f,true)
        text(obj.optString("customerAddress","-").take(58),205f,352f,16f,false,muted)
        text("Inv. No:",865f,280f,18f,true); text("Date:",865f,316f,18f,true); text("Status:",865f,352f,18f,true)
        text(obj.optString("invoiceNo"),960f,280f,18f); text(obj.optString("date"),960f,316f,18f); text(obj.optString("status"),960f,352f,18f)

        p.color = Color.rgb(16,16,16); c.drawRect(70f,405f,1170f,453f,p)
        val cols = floatArrayOf(70f,120f,570f,690f,790f,890f,1010f,1170f)
        val heads = arrayOf("Sr.#","Item Name","Rate","QTY","Dis%","Dis Value","Bonus","Line Total")
        heads.forEachIndexed { i, s -> text(s, cols[i]+8, 436f, 16f, true, Color.WHITE) }
        val lines = obj.optJSONArray("lines")
        var y = 488f; var qtyTotal = 0.0
        if (lines != null) for (i in 0 until lines.length()) {
            val l = lines.getJSONObject(i); val qty = if (l.optDouble("pieces",0.0)>0) l.optDouble("pieces") else l.optDouble("cartons",0.0); qtyTotal += qty
            text((i+1).toString(),82f,y,15f); text(l.optString("name",l.optString("code")).take(46),128f,y,15f)
            text(money.format(l.optDouble("rate",0.0)),578f,y,15f); text(money.format(qty),698f,y,15f)
            text("0.00",798f,y,15f); text("0.00",898f,y,15f); text("0",1018f,y,15f)
            text(money.format(l.optDouble("amount",0.0)),1160f,y,15f,false,Color.rgb(16,16,16),Paint.Align.RIGHT)
            p.color = Color.LTGRAY; p.strokeWidth = 1f; c.drawLine(70f,y+18f,1170f,y+18f,p); y += 42f
        }
        val subtotal = obj.optDouble("total",0.0); val prior = obj.optDouble("previousBalance",0.0); val net = subtotal + prior
        y = maxOf(y+30f,620f)
        p.style = Paint.Style.STROKE; p.color=Color.GRAY; c.drawRect(70f,y,185f,y+28f,p); c.drawRect(70f,y+30f,185f,y+58f,p); p.style=Paint.Style.FILL
        text("T. Item:   ${lines?.length() ?: 0}",78f,y+20f,14f); text("T. Qty:    ${money.format(qtyTotal)}",78f,y+50f,14f)
        val bx=835f; val bw=335f; val rh=38f
        val rows = listOf(Triple("Sub Total",subtotal,true),Triple("Discount",0.0,false),Triple("Any Charges",0.0,false),Triple("Previous Balance",prior,false),Triple("Net Balance",net,true))
        rows.forEachIndexed { j,r -> val yy=y+j*rh; if(r.third){p.color=yellow;c.drawRect(bx,yy,bx+bw,yy+rh-3,p)}; text(r.first,bx+18,yy+25,17f,r.third); text(money.format(r.second),bx+bw-14,yy+25,17f,r.third,Color.rgb(16,16,16),Paint.Align.RIGHT) }

        val stamp = assetBitmap("assets/suh-blue-stamp.png"); val sig = assetBitmap("assets/authorized-signature.png")
        stamp?.let { c.drawBitmap(it,null,RectF(945f,1450f,1100f,1605f),p) }
        sig?.let { c.drawBitmap(it,null,RectF(915f,1485f,1135f,1605f),p) }
        text("Authorized",1025f,1630f,15f,true,Color.rgb(16,16,16),Paint.Align.CENTER)
        p.color=yellow;c.drawRect(70f,1665f,920f,1680f,p);c.drawRect(1125f,1665f,1170f,1680f,p)
        text("Generated by SUH Sales Pro",90f,1710f,14f,false,muted); text("Page 1 of 1",620f,1710f,14f,false,muted,Paint.Align.CENTER)
        logo?.recycle(); stamp?.recycle(); sig?.recycle()
        return bitmap
    }

    private fun saveToDownloads(fileName: String, mimeType: String, bytes: ByteArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName); put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SUH Sales Pro"); put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("create failed")
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("stream failed")
            values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0); contentResolver.update(uri, values, null, null)
        } else {
            val base = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
            val folder = File(base, "SUH Sales Pro").apply { mkdirs() }
            FileOutputStream(File(folder, fileName)).use { it.write(bytes) }
        }
    }

    private fun shareBytes(fileName: String, mimeType: String, bytes: ByteArray) {
        val folder = File(cacheDir, "shared").apply { mkdirs() }
        val file = File(folder, fileName); FileOutputStream(file).use { it.write(bytes) }
        val uri = FileProvider.getUriForFile(this, packageName + ".fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply { type=mimeType; putExtra(Intent.EXTRA_STREAM,uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        runOnUiThread {
            try { startActivity(Intent.createChooser(intent, "Share invoice")) }
            catch (_: Exception) { Toast.makeText(this, "No sharing app available", Toast.LENGTH_SHORT).show() }
        }
    }

    private fun uiToast(message: String) = runOnUiThread { Toast.makeText(this, message, Toast.LENGTH_LONG).show() }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == fileChooserRequestCode) {
            filePathCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); filePathCallback = null; return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
}
