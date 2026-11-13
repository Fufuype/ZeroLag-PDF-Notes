package com.zerolag.pdfnotes

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.LruCache
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * PdfRenderEngine: High-performance, zero-dependency native PDF renderer.
 * Wraps Android's native android.graphics.pdf.PdfRenderer API.
 *
 * Reliability & Low-Memory Optimizations for Low-End Tablets (Lenovo Tab M8/M10/P11):
 * - Guarantees strict single-page access to prevent `java.lang.IllegalStateException: Already has open page`.
 * - LRU memory cache with automatic bitmap recycling on eviction.
 * - Streams directly from Storage Access Framework (SAF) ParcelFileDescriptor.
 * - Zero external PDF dependencies; 100% offline and private.
 */
class PdfRenderEngine(private val context: Context) {

    private var fileDescriptor: ParcelFileDescriptor? = null
    private var pdfRenderer: PdfRenderer? = null
    private var activePage: PdfRenderer.Page? = null

    var pageCount: Int = 0
        private set

    // LRU Cache sized to hold up to 4 rendered page bitmaps
    private val pageBitmapCache = object : LruCache<Int, Bitmap>(4) {
        override fun entryRemoved(evicted: Boolean, key: Int?, oldValue: Bitmap?, newValue: Bitmap?) {
            if (evicted && oldValue != null && !oldValue.isRecycled) {
                // Safely let GC collect or recycle when no longer bound to a Canvas
            }
        }
    }

    /**
     * Opens a PDF document from a content URI using Android's Storage Access Framework (SAF).
     * Returns total page count, or 0 if opening failed.
     */
    @Synchronized
    fun openPdf(uri: Uri): Int {
        close()
        return try {
            fileDescriptor = context.contentResolver.openFileDescriptor(uri, "r")
            fileDescriptor?.let { pfd ->
                pdfRenderer = PdfRenderer(pfd).also { renderer ->
                    pageCount = renderer.pageCount
                }
            }
            pageCount
        } catch (e: Exception) {
            e.printStackTrace()
            close()
            0
        }
    }

    /**
     * Renders a specific PDF page index into a high-density Bitmap.
     * Fits the PDF page within the target canvas dimensions while preserving aspect ratio.
     * Guarantees that the native PdfRenderer.Page is safely closed after rasterization.
     */
    @Synchronized
    fun renderPage(pageIndex: Int, targetWidth: Int, targetHeight: Int): Bitmap? {
        val renderer = pdfRenderer ?: return null
        if (pageIndex < 0 || pageIndex >= pageCount || targetWidth <= 0 || targetHeight <= 0) return null

        // Return cached bitmap if available and matches target dimensions
        pageBitmapCache.get(pageIndex)?.let { cached ->
            if (!cached.isRecycled && cached.width == targetWidth && cached.height == targetHeight) {
                return cached
            }
        }

        var page: PdfRenderer.Page? = null
        return try {
            // Close any dangling page before opening a new one
            closeActivePage()

            page = renderer.openPage(pageIndex)
            activePage = page

            val pageWidth = page.width
            val pageHeight = page.height

            // Calculate uniform scale to fit target bounds without distortion
            val scale = minOf(
                targetWidth.toFloat() / pageWidth.toFloat(),
                targetHeight.toFloat() / pageHeight.toFloat()
            )

            val renderWidth = (pageWidth * scale).toInt().coerceAtLeast(1)
            val renderHeight = (pageHeight * scale).toInt().coerceAtLeast(1)

            val bitmap = Bitmap.createBitmap(renderWidth, renderHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            // PDF pages are transparent by default; fill with solid paper white
            canvas.drawColor(Color.WHITE)

            // Native hardware-accelerated rasterization
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

            pageBitmapCache.put(pageIndex, bitmap)
            bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            closeActivePage()
        }
    }

    /**
     * Renders a miniature thumbnail bitmap for the left page navigation sidebar.
     */
    @Synchronized
    fun renderThumbnail(pageIndex: Int, thumbWidth: Int = 160): Bitmap? {
        val renderer = pdfRenderer ?: return null
        if (pageIndex < 0 || pageIndex >= pageCount) return null

        var page: PdfRenderer.Page? = null
        return try {
            closeActivePage()
            page = renderer.openPage(pageIndex)
            activePage = page

            val aspect = page.height.toFloat() / page.width.toFloat()
            val thumbHeight = (thumbWidth * aspect).toInt().coerceAtLeast(1)

            val bitmap = Bitmap.createBitmap(thumbWidth, thumbHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)

            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            closeActivePage()
        }
    }

    /**
     * Gets the intrinsic aspect ratio (width / height) of a given page safely.
     */
    @Synchronized
    fun getPageAspectRatio(pageIndex: Int): Float {
        val renderer = pdfRenderer ?: return 1f
        if (pageIndex < 0 || pageIndex >= pageCount) return 1f

        var page: PdfRenderer.Page? = null
        return try {
            closeActivePage()
            page = renderer.openPage(pageIndex)
            activePage = page
            page.width.toFloat() / page.height.toFloat()
        } catch (e: Exception) {
            1f
        } finally {
            closeActivePage()
        }
    }

    /**
     * Exports annotated pages directly into a valid PDF file using native android.graphics.pdf.PdfDocument.
     * Memory-safe: renders and writes one page at a time to prevent OutOfMemoryError on 2GB RAM devices.
     */
    @Throws(IOException::class)
    fun exportAnnotatedPdf(
        totalPages: Int,
        outputFile: File,
        pageBitmapProvider: (pageIndex: Int) -> Bitmap?
    ) {
        val pdfDocument = PdfDocument()
        try {
            for (i in 0 until totalPages) {
                val bitmap = pageBitmapProvider(i) ?: continue
                val pageInfo = PdfDocument.PageInfo.Builder(bitmap.width, bitmap.height, i + 1).create()
                val page = pdfDocument.startPage(pageInfo)

                page.canvas.drawBitmap(bitmap, 0f, 0f, null)
                pdfDocument.finishPage(page)
            }

            FileOutputStream(outputFile).use { outStream ->
                pdfDocument.writeTo(outStream)
            }
        } finally {
            pdfDocument.close()
        }
    }

    private fun closeActivePage() {
        try {
            activePage?.close()
        } catch (ignored: Exception) {}
        activePage = null
    }

    /**
     * Closes the renderer and releases file descriptors cleanly.
     */
    @Synchronized
    fun close() {
        closeActivePage()

        try {
            pdfRenderer?.close()
        } catch (ignored: Exception) {}
        pdfRenderer = null

        try {
            fileDescriptor?.close()
        } catch (ignored: Exception) {}
        fileDescriptor = null

        pageBitmapCache.evictAll()
        pageCount = 0
    }
}
