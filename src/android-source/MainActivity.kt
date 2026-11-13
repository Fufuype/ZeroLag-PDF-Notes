package com.zerolag.pdfnotes

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.Path
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.OutputStream

/**
 * MainActivity: Ultra-lightweight Jetpack Compose entry point.
 * Hosts the hardware-accelerated DrawingCanvasView, collapsible Google-PDF style left thumbnail drawer,
 * and top-anchored floating annotation toolbar.
 *
 * Optimized specifically for low-end tablets (Lenovo Tab M8/M10, Tab P11) with Active Pen/Precision Pen.
 */
class MainActivity : ComponentActivity() {

    private lateinit var pdfEngine: PdfRenderEngine
    private var canvasView: DrawingCanvasView? = null

    // Per-page stroke cache (Page index -> List of drawn strokes)
    private val pageAnnotations = mutableMapOf<Int, List<Stroke>>()

    // Storage Access Framework Launchers
    private val openPdfLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri?.let { loadPdfDocument(it) }
    }

    private val exportPdfLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri: Uri? ->
        uri?.let { exportAnnotatedPdfToUri(it) }
    }

    // State holders
    private var currentPdfUri by mutableStateOf<Uri?>(null)
    private var totalPages by mutableIntStateOf(0)
    private var currentPageIndex by mutableIntStateOf(0)
    private var canUndo by mutableStateOf(false)
    private var canRedo by mutableStateOf(false)
    private var isSidebarOpen by mutableStateOf(false)
    private var isExporting by mutableStateOf(false)

    // Thumbnail cache for left sidebar
    private val pageThumbnails = mutableStateMapOf<Int, Bitmap>()

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
        val coroutineScope = rememberCoroutineScope()
        var activeTool by remember { mutableStateOf(ToolMode.PEN) }
        var penColor by remember { mutableIntStateOf(AndroidColor.BLACK) }
        var penWidth by remember { mutableFloatStateOf(4.5f) }
        var highlighterColor by remember { mutableIntStateOf(AndroidColor.parseColor("#FBBF24")) }
        var highlighterWidth by remember { mutableFloatStateOf(24f) }

        var isToolbarVisible by remember { mutableStateOf(true) }
        var showColorPicker by remember { mutableStateOf(false) }
        var showExportDialog by remember { mutableStateOf(false) }

        val activeColor = if (activeTool == ToolMode.HIGHLIGHTER) highlighterColor else penColor

        val penPaletteColors = remember {
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

        val highlighterPaletteColors = remember {
            listOf(
                AndroidColor.parseColor("#FBBF24"), // Fosforlu Sarı
                AndroidColor.parseColor("#FACC15"), // Parlak Limon
                AndroidColor.parseColor("#22C55E"), // Fosforlu Yeşil
                AndroidColor.parseColor("#4ADE80"), // Pastel Nane
                AndroidColor.parseColor("#06B6D4"), // Canlı Turkuaz
                AndroidColor.parseColor("#38BDF8"), // Bebek Mavisi
                AndroidColor.parseColor("#60A5FA"), // Gök Mavisi
                AndroidColor.parseColor("#A855F7"), // Canlı Lila
                AndroidColor.parseColor("#C084FC"), // Lavanta Moru
                AndroidColor.parseColor("#F472B6"), // Pastel Pembe
                AndroidColor.parseColor("#FB7185"), // Gül Pembesi
                AndroidColor.parseColor("#FB923C"), // Açık Şeftali
            )
        }

        val currentPalette = if (activeTool == ToolMode.HIGHLIGHTER) highlighterPaletteColors else penPaletteColors

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
                        view.penColor = penColor
                        view.penStrokeWidth = penWidth
                        view.highlighterColor = highlighterColor
                        view.highlighterStrokeWidth = highlighterWidth
                        view.onHistoryChanged = { undoable, redoable ->
                            canUndo = undoable
                            canRedo = redoable
                        }
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            // 2. Sol Açılır/Kapanır Sayfa Gezinme Çekmecesi (Google PDF Stili Küçük Resimler)
            AnimatedVisibility(
                visible = isSidebarOpen && totalPages > 0,
                enter = slideInHorizontally(initialOffsetX = { -it }) + fadeIn(),
                exit = slideOutHorizontally(targetOffsetY = { 0 }, targetOffsetX = { -it }) + fadeOut(),
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxHeight()
                    .width(180.dp)
                    .zIndex(10f)
            ) {
                Surface(
                    color = Color(0xF21E1E24),
                    shadowElevation = 16.dp,
                    modifier = Modifier
                        .fillMaxHeight()
                        .border(width = 1.dp, color = Color(0x33FFFFFF), shape = RoundedCornerShape(topEnd = 16.dp, bottomEnd = 16.dp))
                ) {
                    Column(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = "Sayfalar ($totalPages)",
                                style = MaterialTheme.typography.titleSmall,
                                color = Color.White
                            )
                            IconButton(
                                onClick = { isSidebarOpen = false },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Kapat", tint = Color.LightGray)
                            }
                        }

                        val listState = rememberLazyListState()
                        LazyColumn(
                            state = listState,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(totalPages) { pageIdx ->
                                val isSelected = pageIdx == currentPageIndex
                                val thumbnail = pageThumbnails[pageIdx]
                                val hasNotes = pageAnnotations[pageIdx]?.isNotEmpty() == true

                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSelected) Color(0xFF2563EB).copy(alpha = 0.25f) else Color(0xFF2A2A32)
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .border(
                                            width = if (isSelected) 2.dp else 1.dp,
                                            color = if (isSelected) Color(0xFF3B82F6) else Color(0x22FFFFFF),
                                            shape = RoundedCornerShape(10.dp)
                                        )
                                        .clickable {
                                            switchPage(pageIdx)
                                        }
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.padding(6.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(130.dp)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(Color.White),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (thumbnail != null) {
                                                androidx.compose.foundation.Image(
                                                    bitmap = thumbnail.asImageBitmap(),
                                                    contentDescription = "Sayfa ${pageIdx + 1}",
                                                    modifier = Modifier.fillMaxSize()
                                                )
                                            } else {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(20.dp),
                                                    strokeWidth = 2.dp,
                                                    color = Color.Gray
                                                )
                                            }

                                            if (hasNotes) {
                                                Box(
                                                    modifier = Modifier
                                                        .align(Alignment.TopEnd)
                                                        .padding(4.dp)
                                                        .size(18.dp)
                                                        .clip(CircleShape)
                                                        .background(Color(0xFF2563EB)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        Icons.Default.Edit,
                                                        contentDescription = "Not var",
                                                        tint = Color.White,
                                                        modifier = Modifier.size(10.dp)
                                                    )
                                                }
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "${pageIdx + 1}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (isSelected) Color(0xFF60A5FA) else Color.LightGray
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 3. Sol Üst Sayfa Gezinme ve Kenar Çubuğu Açma Butonu
            if (totalPages > 0) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xDD1E1E24),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 16.dp, top = 80.dp)
                        .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(20.dp))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        IconButton(
                            onClick = { isSidebarOpen = !isSidebarOpen },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.ViewSidebar, contentDescription = "Sayfalar Sekmesi", tint = Color.White)
                        }

                        Box(modifier = Modifier.width(1.dp).height(18.dp).background(Color(0x33FFFFFF)))

                        IconButton(
                            onClick = { if (currentPageIndex > 0) switchPage(currentPageIndex - 1) },
                            enabled = currentPageIndex > 0,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                Icons.Default.ArrowBack,
                                contentDescription = "Önceki Sayfa",
                                tint = if (currentPageIndex > 0) Color.White else Color.DarkGray
                            )
                        }

                        Text(
                            text = "${currentPageIndex + 1} / $totalPages",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )

                        IconButton(
                            onClick = { if (currentPageIndex < totalPages - 1) switchPage(currentPageIndex + 1) },
                            enabled = currentPageIndex < totalPages - 1,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                Icons.Default.ArrowForward,
                                contentDescription = "Sonraki Sayfa",
                                tint = if (currentPageIndex < totalPages - 1) Color.White else Color.DarkGray
                            )
                        }
                    }
                }
            }

            // 4. Üst Kısma Alınan Minimalist Yüzen Araç Çubuğu
            AnimatedVisibility(
                visible = isToolbarVisible,
                enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterVertically) {
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

                            // Bölücü (Tüm Compose sürümleri ile %100 uyumlu)
                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(Color(0x33FFFFFF)))

                            // Kalem
                            ToolIconToggle(
                                icon = Icons.Default.Edit,
                                label = "Kalem",
                                isSelected = activeTool == ToolMode.PEN,
                                onClick = {
                                    activeTool = ToolMode.PEN
                                    canvasView?.currentMode = ToolMode.PEN
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

                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(Color(0x33FFFFFF)))

                            // Renk Seçici Butonu (Seçili aracın rengini gösterir)
                            Box(
                                modifier = Modifier
                                    .size(30.dp)
                                    .clip(CircleShape)
                                    .background(Color(activeColor))
                                    .border(2.dp, Color.White, CircleShape)
                                    .clickable { showColorPicker = !showColorPicker }
                            )

                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(Color(0x33FFFFFF)))

                            // Geri Al
                            IconButton(
                                onClick = { canvasView?.undo() },
                                enabled = canUndo,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    Icons.Default.Undo,
                                    contentDescription = "Geri Al",
                                    tint = if (canUndo) Color.White else Color.DarkGray
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
                                    tint = if (canRedo) Color.White else Color.DarkGray
                                )
                            }

                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(Color(0x33FFFFFF)))

                            // Dışa Aktar Butonu
                            Button(
                                onClick = { showExportDialog = true },
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

                    // En az 10 Farklı Renkten Oluşan Renk Paleti (Kalem ve Vurgulayıcı birbirinden bağımsız)
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
                                currentPalette.forEach { colorInt ->
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
                                                if (activeTool == ToolMode.HIGHLIGHTER) {
                                                    highlighterColor = colorInt
                                                    canvasView?.highlighterColor = colorInt
                                                } else {
                                                    penColor = colorInt
                                                    canvasView?.penColor = colorInt
                                                }
                                                showColorPicker = false
                                            }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Dışa Aktarma İletişim Kutusu (PDF vs Sayfa Görüntüsü)
            if (showExportDialog) {
                AlertDialog(
                    onDismissRequest = { showExportDialog = false },
                    title = { Text("Dışa Aktar", color = Color.White) },
                    text = {
                        Column {
                            Text(
                                "Notlarınızı orijinal PDF formatında veya tek sayfalık yüksek çözünürlüklü görüntü olarak kaydedebilirsiniz:",
                                color = Color.LightGray,
                                fontSize = 14.sp
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                showExportDialog = false
                                exportPdfLauncher.launch("Notlar_${System.currentTimeMillis()}.pdf")
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                        ) {
                            Text("PDF Olarak Kaydet (Tüm Sayfalar)")
                        }
                    },
                    dismissButton = {
                        TextButton(
                            onClick = {
                                showExportDialog = false
                                exportCurrentPageAsImage()
                            }
                        ) {
                            Text("Görüntü (PNG)", color = Color(0xFF93C5FD))
                        }
                    },
                    containerColor = Color(0xFF1E1E24)
                )
            }

            // İşlem Göstergesi (PDF Dışa Aktarılırken)
            if (isExporting) {
                Surface(
                    color = Color(0xAA000000),
                    modifier = Modifier.fillMaxSize().zIndex(100f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFF27272A),
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(24.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                CircularProgressIndicator(color = Color(0xFF3B82F6))
                                Text("PDF Dışa Aktarılıyor...", color = Color.White)
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
        pageAnnotations.clear()
        pageThumbnails.clear()

        val pages = pdfEngine.openPdf(uri)
        totalPages = pages
        currentPageIndex = 0

        if (pages > 0) {
            renderCurrentPage()
            loadThumbnailsInBackground(pages)
            Toast.makeText(this, "PDF Yüklendi: $pages Sayfa", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "PDF Dosyası Açılamadı", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * Arka planda sol kenar çubuğu için düşük çözünürlüklü küçük resimleri (thumbnails) yükler.
     * Belleği korumak için 140px genişlikte çizilir.
     */
    private fun loadThumbnailsInBackground(total: Int) {
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            for (i in 0 until total) {
                val thumb = pdfEngine.renderThumbnail(i, 140)
                if (thumb != null) {
                    withContext(Dispatchers.Main) {
                        pageThumbnails[i] = thumb
                    }
                }
            }
        }
    }

    /**
     * Sayfalar arası geçiş: Mevcut sayfanın çizimlerini kaydeder, hedef sayfanın çizimlerini yükler.
     */
    private fun switchPage(newIndex: Int) {
        if (newIndex < 0 || newIndex >= totalPages) return

        // 1. Mevcut sayfadaki çizimleri önbelleğe kaydet
        canvasView?.let {
            pageAnnotations[currentPageIndex] = it.getStrokesCopy()
        }

        // 2. Yeni sayfaya geç
        currentPageIndex = newIndex

        // 3. Yeni sayfanın çizimlerini tuvale yükle
        val savedStrokes = pageAnnotations[newIndex] ?: emptyList()
        canvasView?.setStrokes(savedStrokes)

        // 4. PDF sayfa arka planını render et
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

    /**
     * Tüm sayfaları ve üzerlerindeki el yazısı notları birleştirerek gerçek bir PDF dosyası olarak dışa aktarır.
     */
    private fun exportAnnotatedPdfToUri(destinationUri: Uri) {
        // Mevcut sayfanın aktif çizimlerini önbelleğe al
        canvasView?.let {
            pageAnnotations[currentPageIndex] = it.getStrokesCopy()
        }

        isExporting = true
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            try {
                val tempPdfFile = File(cacheDir, "temp_export_${System.currentTimeMillis()}.pdf")
                val exportWidth = 1080
                val exportHeight = 1920

                val success = pdfEngine.exportAnnotatedPdf(totalPages, tempPdfFile) { pageIdx, w, h ->
                    // Her sayfa için PDF arka planını render et
                    val bgBitmap = pdfEngine.renderPage(pageIdx, exportWidth, exportHeight) ?: return@exportAnnotatedPdf null
                    
                    // Üzerine o sayfanın el yazısı notlarını çiz
                    val combinedBitmap = Bitmap.createBitmap(exportWidth, exportHeight, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(combinedBitmap)
                    canvas.drawBitmap(bgBitmap, 0f, 0f, null)

                    val strokes = pageAnnotations[pageIdx] ?: emptyList()
                    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        style = Paint.Style.STROKE
                        strokeCap = Paint.Cap.ROUND
                        strokeJoin = Paint.Join.ROUND
                    }

                    for (stroke in strokes) {
                        paint.color = stroke.color
                        paint.strokeWidth = stroke.width
                        if (stroke.mode == ToolMode.HIGHLIGHTER) {
                            paint.alpha = 110
                        } else {
                            paint.alpha = 255
                        }
                        canvas.drawPath(stroke.path, paint)
                    }

                    bgBitmap.recycle()
                    combinedBitmap
                }

                if (success && tempPdfFile.exists()) {
                    contentResolver.openOutputStream(destinationUri)?.use { out ->
                        FileInputStream(tempPdfFile).use { input ->
                            input.copyTo(out)
                        }
                    }
                    tempPdfFile.delete()

                    withContext(Dispatchers.Main) {
                        isExporting = false
                        Toast.makeText(this@MainActivity, "PDF Başarıyla Kaydedildi!", Toast.LENGTH_LONG).show()
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        isExporting = false
                        Toast.makeText(this@MainActivity, "PDF Dışa Aktarılamadı", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                withContext(Dispatchers.Main) {
                    isExporting = false
                    Toast.makeText(this@MainActivity, "Hata: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    /**
     * Yalnızca mevcut sayfayı ve notları PNG görüntüsü olarak Downloads klasörüne kaydeder.
     */
    private fun exportCurrentPageAsImage() {
        val view = canvasView ?: return
        val flattened = view.createFlattenedBitmap()

        try {
            val filename = "ZeroLag_Sayfa_${currentPageIndex + 1}_${System.currentTimeMillis()}.png"
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
                flattened.compress(Bitmap.CompressFormat.PNG, 100, out)
            }

            Toast.makeText(this, "Downloads Klasörüne Kaydedildi: $filename", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Görüntü aktarma hatası: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        for (thumb in pageThumbnails.values) {
            if (!thumb.isRecycled) thumb.recycle()
        }
        pageThumbnails.clear()
        pdfEngine.close()
    }
}
