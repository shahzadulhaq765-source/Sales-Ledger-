package com.suh.salespro

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
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
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequestCode = 7341
    private val appUrl = "https://shahzadulhaq765-source.github.io/Sales-Ledger-/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.addJavascriptInterface(AndroidBridge(), "SUHAndroid")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                return try {
                    startActivityForResult(fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }, fileChooserRequestCode)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    Toast.makeText(this@MainActivity, "File picker could not open", Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.host == "shahzadulhaq765-source.github.io") false
                else {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                }
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("http://") || url.startsWith("https://")) {
                try {
                    val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    val request = DownloadManager.Request(Uri.parse(url))
                        .setMimeType(mimeType)
                        .addRequestHeader("User-Agent", userAgent)
                        .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                        .setTitle(fileName)
                        .setDescription("SUH Sales Pro download")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                    Toast.makeText(this, "$fileName downloading", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Download could not start", Toast.LENGTH_SHORT).show()
                }
            }
        }

        if (savedInstanceState == null) webView.loadUrl(appUrl)
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun saveBase64(fileName: String, mimeType: String, base64Data: String) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                        put(MediaStore.Downloads.MIME_TYPE, mimeType)
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SUH Sales Pro")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Could not create download")
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    contentResolver.update(uri, values, null, null)
                } else {
                    val dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                    val folder = File(dir, "SUH Sales Pro")
                    if (!folder.exists()) folder.mkdirs()
                    FileOutputStream(File(folder, fileName)).use { it.write(bytes) }
                }
                runOnUiThread { Toast.makeText(this@MainActivity, "$fileName saved", Toast.LENGTH_SHORT).show() }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this@MainActivity, "Could not save $fileName", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface
        fun shareBase64(fileName: String, mimeType: String, base64Data: String) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val folder = File(cacheDir, "shared")
                if (!folder.exists()) folder.mkdirs()
                val file = File(folder, fileName)
                FileOutputStream(file).use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(this@MainActivity, packageName + ".fileprovider", file)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread { startActivity(Intent.createChooser(intent, "Share invoice on WhatsApp")) }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this@MainActivity, "Could not share invoice", Toast.LENGTH_SHORT).show() }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == fileChooserRequestCode) {
            val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
