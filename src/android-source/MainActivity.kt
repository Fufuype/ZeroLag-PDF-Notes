package com.zerolag.pdfnotes

import android.content.ContentValues
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

/**
 * MainActivity: Lightweight Jetpack Compose entry point.
 * Hosts the hardware-accelerated DrawingCanvasView and auto-hiding floating toolbar.
 *
 * Designed for Lenovo Tab M8/M10, Tab P11 with Active Pen/Precision Pen.
 */
class MainActivity : ComponentActivity() {

    private lateinit var pdfEngine: PdfRenderEngine
    private var canvasView: DrawingCanvasView? = null

    // SAF File Picker
    private val openPdfLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri?.let { loadPdfDocument(it) }
    }

    // State holders
    private var currentPdfUri by mutableStateOf<Uri?>(null)
    private var totalPages by mutableIntStateOf(0)
    private var currentPageIndex by mutableIntStateOf(0)
    private var canUndo by mutableStateOf(false)
    private var canRedo by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pdfEngine = PdfRenderEngine(this)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6),
                    surface = Color(0xFF1E1E1E),
                    background = Color(0xFF121212)
                )
            ) {
                MainScreen()
            }
        }
    }

    @Composable
    fun MainScreen() {
        var activeTool by remember { mutableStateOf(ToolMode.PEN) }
        var activeColor by remember { mutableStateOf(AndroidColor.BLACK) }
        var activeWidth by remember { mutableFloatStateOf(4.5f) }
        var isToolbarVisible by remember { mutableStateOf(true) }
        var showColorPicker by remember { mutableStateOf(false) }

        val paletteColors = remember {
            listOf(
                AndroidColor.BLACK,
                AndroidColor.parseColor("#1E3A8A"), // Koyu Gece Mavisi
                AndroidColor.parseColor("#2563EB"), // Kobalt Mavisi
                AndroidColor.parseColor("#0284C7"), // Gök Mavisi
                AndroidColor.parseColor("#059669"), // Zümrüt Yeşili
                AndroidColor.parseColor("#16A34A"), // Açık Canlı Yeşil
                AndroidColor.parseColor("#DC2626"), // Koyu Kırmızı
                AndroidColor.parseColor("#EA580C"), // Canlı Turuncu
                AndroidColor.parseColor("#F59E0B"), // Kehribar Sarısı
                AndroidColor.parseColor("#7C3AED"), // Asil Mor
                AndroidColor.parseColor("#DB2777"), // Fuşya Pembe
                AndroidColor.parseColor("#78350F"), // Sıcak Kahverengi
            )
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF18181B))
        ) {
            // 1. Donanım Hızlandırmalı Özel Çizim Tuvali
            AndroidView(
                factory = { context ->
                    DrawingCanvasView(context).also { view ->
                        canvasView = view
                        view.currentMode = activeTool
                        view.strokeColor = activeColor
                        view.baseStrokeWidth = activeWidth
                        view.onHistoryChanged = { undoable, redoable ->
                            canUndo = undoable
                            canRedo = redoable
                        }
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            // 2. Sayfa Gezinme Göstergesi (Sol Üst)
            if (totalPages > 0) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xCC1E1E1E),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 16.dp, top = 80.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        IconButton(
                            onClick = { if (currentPageIndex > 0) switchPage(currentPageIndex - 1) },
                            enabled = currentPageIndex > 0,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Önceki Sayfa", tint = Color.White)
                        }

                        Text(
                            text = "Sayfa ${currentPageIndex + 1} / $totalPages",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )

                        IconButton(
                            onClick = { if (currentPageIndex < totalPages - 1) switchPage(currentPageIndex + 1) },
                            enabled = currentPageIndex < totalPages - 1,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.ArrowForward, contentDescription = "Sonraki Sayfa", tint = Color.White)
                        }
                    }
                }
            }

            // 3. Üst Kısma Alınan Minimalist Yüzen Araç Çubuğu (Kalem/Araç Seçimi)
            AnimatedVisibility(
                visible = isToolbarVisible,
                enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterVertically) {
                    // Ana Araç Çubuğu (Üstte)
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xF018181B),
                        modifier = Modifier
                            .shadow(12.dp, RoundedCornerShape(20.dp))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(20.dp))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            // PDF Aç
                            ToolIconAction(
                                icon = Icons.Default.FolderOpen,
                                label = "PDF Aç",
                                onClick = { openPdfLauncher.launch(arrayOf("application/pdf")) }
                            )

                            VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                            // Kalem
                            ToolIconToggle(
                                icon = Icons.Default.Edit,
                                label = "Kalem",
                                isSelected = activeTool == ToolMode.PEN,
                                onClick = {
                                    activeTool = ToolMode.PEN
                                    canvasView?.currentMode = ToolMode.PEN
                                    canvasView?.strokeColor = activeColor
                                    canvasView?.baseStrokeWidth = activeWidth
                                }
                            )

                            // Vurgulayıcı
                            ToolIconToggle(
                                icon = Icons.Default.Brush,
                                label = "Vurgulayıcı",
                                isSelected = activeTool == ToolMode.HIGHLIGHTER,
                                onClick = {
                                    activeTool = ToolMode.HIGHLIGHTER
                                    canvasView?.currentMode = ToolMode.HIGHLIGHTER
                                    canvasView?.strokeColor = AndroidColor.parseColor("#F59E0B")
                                    canvasView?.baseStrokeWidth = activeWidth
                                }
                            )

                            // Silgi
                            ToolIconToggle(
                                icon = Icons.Default.AutoFixNormal,
                                label = "Silgi",
                                isSelected = activeTool == ToolMode.ERASER_STROKE,
                                onClick = {
                                    activeTool = ToolMode.ERASER_STROKE
                                    canvasView?.currentMode = ToolMode.ERASER_STROKE
                                }
                            )

                            // Kement
                            ToolIconToggle(
                                icon = Icons.Default.CropFree,
                                label = "Kement",
                                isSelected = activeTool == ToolMode.LASSO,
                                onClick = {
                                    activeTool = ToolMode.LASSO
                                    canvasView?.currentMode = ToolMode.LASSO
                                }
                            )

                            VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                            // Renk Seçici Tetikleyici (Seçili rengi gösterir)
                            Box(
                                modifier = Modifier
                                    .size(30.dp)
                                    .clip(CircleShape)
                                    .background(Color(activeColor))
                                    .border(2.dp, Color.White, CircleShape)
                                    .clickable { showColorPicker = !showColorPicker }
                            )

                            VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                            // Geri Al
                            IconButton(
                                onClick = { canvasView?.undo() },
                                enabled = canUndo,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    Icons.Default.Undo,
                                    contentDescription = "Geri Al",
                                    tint = if (canUndo) Color.White else Color.Gray
                                )
                            }

                            // Yinele
                            IconButton(
                                onClick = { canvasView?.redo() },
                                enabled = canRedo,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    Icons.Default.Redo,
                                    contentDescription = "Yinele",
                                    tint = if (canRedo) Color.White else Color.Gray
                                )
                            }

                            VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp))

                            // Dışa Aktar
                            Button(
                                onClick = { exportAnnotatedDocument() },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Icon(
                                    Icons.Default.FileDownload,
                                    contentDescription = "Dışa Aktar",
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Dışa Aktar", style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }

                    // En az 10 Farklı Renkten Oluşan Renk Paleti Seçicisi (Araç çubuğunun hemen altında)
                    if (showColorPicker && (activeTool == ToolMode.PEN || activeTool == ToolMode.HIGHLIGHTER)) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xEE27272A),
                            modifier = Modifier
                                .padding(top = 8.dp)
                                .shadow(8.dp, RoundedCornerShape(16.dp))
                                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                paletteColors.forEach { colorInt ->
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(CircleShape)
                                            .background(Color(colorInt))
                                            .border(
                                                width = if (activeColor == colorInt) 2.5.dp else 1.dp,
                                                color = if (activeColor == colorInt) Color.White else Color(0x44FFFFFF),
                                                shape = CircleShape
                                            )
                                            .clickable {
                                                activeColor = colorInt
                                                canvasView?.strokeColor = colorInt
                                                showColorPicker = false
                                            }
                                    )
                                }
                            }
                        }
                    }
                }
        }
    }

    @Composable
    private fun ToolIconToggle(
        icon: ImageVector,
        label: String,
        isSelected: Boolean,
        onClick: () -> Unit
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (isSelected) Color(0xFF2563EB) else Color.Transparent)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isSelected) Color.White else Color(0xFFA1A1AA),
                modifier = Modifier.size(20.dp)
            )
        }
    }

    @Composable
    private fun ToolIconAction(
        icon: ImageVector,
        label: String,
        onClick: () -> Unit
    ) {
        IconButton(onClick = onClick, modifier = Modifier.size(40.dp)) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
    }

    private fun loadPdfDocument(uri: Uri) {
        currentPdfUri = uri
        val pages = pdfEngine.openPdf(uri)
        totalPages = pages
        currentPageIndex = 0

        if (pages > 0) {
            renderCurrentPage()
            Toast.makeText(this, "Loaded PDF: $pages pages", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Failed to parse PDF document", Toast.LENGTH_LONG).show()
        }
    }

    private fun switchPage(index: Int) {
        currentPageIndex = index
        canvasView?.clearAllStrokes()
        renderCurrentPage()
    }

    private fun renderCurrentPage() {
        val view = canvasView ?: return
        view.post {
            val width = view.width.coerceAtLeast(1080)
            val height = view.height.coerceAtLeast(1920)
            val bitmap = pdfEngine.renderPage(currentPageIndex, width, height)
            view.pdfBackground = bitmap
        }
    }

    private fun exportAnnotatedDocument() {
        val view = canvasView ?: return
        val flattened = view.createFlattenedBitmap()

        try {
            val filename = "ZeroLag_Annotated_${System.currentTimeMillis()}.png"
            var outputStream: OutputStream? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val imageUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (imageUri != null) {
                    outputStream = resolver.openOutputStream(imageUri)
                }
            } else {
                val imagesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val image = File(imagesDir, filename)
                outputStream = FileOutputStream(image)
            }

            outputStream?.use { out ->
                flattened.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
            }

            Toast.makeText(this, "Saved to Downloads: $filename", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Export failed: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        pdfEngine.close()
    }
}
