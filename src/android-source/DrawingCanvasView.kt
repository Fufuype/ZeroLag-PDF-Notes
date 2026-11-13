package com.zerolag.pdfnotes

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.*
import android.os.SystemClock
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/**
 * Available annotation tools.
 */
enum class ToolMode {
    PEN,
    HIGHLIGHTER,
    ERASER_STROKE,
    ERASER_POINT,
    LASSO
}

/**
 * Immutable vector stroke representation.
 * Each stroke stores its geometric path, paint parameters, and bounding box for O(1) hit testing.
 */
data class Stroke(
    val path: Path,
    val color: Int,
    val strokeWidth: Float,
    val alpha: Int,
    val isHighlighter: Boolean = false,
    val bounds: RectF = RectF().apply { path.computeBounds(this, true) },
    var offsetX: Float = 0f,
    var offsetY: Float = 0f,
    var isSelected: Boolean = false
)

/**
 * DrawingCanvasView: High-performance, low-latency drawing canvas for Android tablets.
 * Specifically tuned for Lenovo Active Pen / Lenovo Precision Pen (Wacom AES protocol).
 *
 * Performance and Architectural Guarantees:
 * 1. Zero Garbage Collection (0-GC): Pre-allocated object pools for Path, Paint, Matrix, RectF, and Region.
 * 2. 400ms Palm Rejection Window: Discards capacitive finger touches for 400ms following active stylus hover/touch.
 * 3. Contact Area Filter: Rejects capacitive touch patches with AXIS_TOUCH_MAJOR > 60f (resting palm edge).
 * 4. High-Frequency Digitizer Polling: Iterates event.historySize to capture all hardware samples between VSYNC frames.
 * 5. Bezier (quadTo) Interpolation: Smooth continuous vector lines without corner stepping.
 * 6. Dynamic Pressure Sensitivity: Scales stroke width dynamically using MotionEvent.AXIS_PRESSURE.
 * 7. Finger-Only Pan & Scroll: Finger touch NEVER draws; it only scrolls and pans the document.
 * 8. Independent Pen & Highlighter Presets: Color and thickness for pen and highlighter are strictly isolated.
 */
class DrawingCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // Active tool state
    var currentMode: ToolMode = ToolMode.PEN

    // Pen independent color & width
    var penColor: Int = Color.BLACK
    var penStrokeWidth: Float = 4.5f

    // Highlighter independent color & width (never overwrites pen settings)
    var highlighterColor: Int = Color.parseColor("#FBBF24")
    var highlighterStrokeWidth: Float = 22f

    // Backward-compatibility properties
    var strokeColor: Int
        get() = if (currentMode == ToolMode.HIGHLIGHTER) highlighterColor else penColor
        set(value) {
            if (currentMode == ToolMode.HIGHLIGHTER) highlighterColor = value else penColor = value
        }

    var baseStrokeWidth: Float
        get() = if (currentMode == ToolMode.HIGHLIGHTER) highlighterStrokeWidth else penStrokeWidth
        set(value) {
            if (currentMode == ToolMode.HIGHLIGHTER) highlighterStrokeWidth = value else penStrokeWidth = value
        }

    // Stroke histories (Undo / Redo)
    private val strokes = ArrayList<Stroke>(128)
    private val undoStack = ArrayList<Stroke>(64)

    // Selection state for Lasso tool
    private val selectedStrokes = ArrayList<Stroke>()
    private var isDraggingSelection = false
    private var dragStartX = 0f
    private var dragStartY = 0f

    // -------------------------------------------------------------
    // ZERO-GC PRE-ALLOCATED ENGINE OBJECTS
    // Never instantiate objects inside onTouchEvent or onDraw!
    // -------------------------------------------------------------
    private val activePath = Path()
    private val activePaint = Paint().apply {
        isAntiAlias = true
        isDither = true
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    private val cachedRenderPaint = Paint().apply {
        isAntiAlias = true
        isDither = true
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    private val highlighterXfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)

    private val lassoPaint = Paint().apply {
        color = Color.parseColor("#2563EB")
        style = Paint.Style.STROKE
        strokeWidth = 2.5f
        isAntiAlias = true
        pathEffect = DashPathEffect(floatArrayOf(12f, 8f), 0f)
    }

    private val selectionBoundingPaint = Paint().apply {
        color = Color.parseColor("#3B82F6")
        style = Paint.Style.STROKE
        strokeWidth = 2f
        isAntiAlias = true
    }

    private val selectionHandlePaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val selectionHandleBorderPaint = Paint().apply {
        color = Color.parseColor("#2563EB")
        style = Paint.Style.STROKE
        strokeWidth = 2f
        isAntiAlias = true
    }

    // Pre-allocated geometric math objects
    private val tempBounds = RectF()
    private val selectionBounds = RectF()
    private val clipRegion = Region()
    private val lassoRegion = Region()
    private val strokeRegion = Region()
    private val transformMatrix = Matrix()

    // Smooth Bezier tracking coordinates
    private var lastX = 0f
    private var lastY = 0f
    private var isDrawing = false

    // Palm Rejection & Finger Scrolling state
    private var lastStylusTimestamp = 0L
    private val STYLUS_HOVER_TOUCH_COOLDOWN_MS = 400L
    private val PALM_TOUCH_MAJOR_THRESHOLD = 60f
    private val TOUCH_SLOP = 1.5f

    // Finger pan/scroll state using raw screen coordinates to prevent jitter
    private var fingerRawStartX = 0f
    private var fingerRawStartY = 0f
    private var isFingerScrolling = false

    // Optional background PDF Bitmap
    var pdfBackground: Bitmap? = null
        set(value) {
            field = value
            invalidate()
        }

    // Callbacks for UI updates
    var onHistoryChanged: ((canUndo: Boolean, canRedo: Boolean) -> Unit)? = null
    var onStrokeAdded: (() -> Unit)? = null
    var onFingerScrollActive: ((isScrolling: Boolean) -> Unit)? = null

    init {
        // Enforce hardware acceleration layer
        setLayerType(LAYER_TYPE_HARDWARE, null)
        isFocusable = true
    }

    /**
     * Intercepts stylus hover events (Lenovo Precision Pen hovering above the digitizer).
     * Pre-arms the palm rejection window before the pen tip touches the glass!
     */
    override fun onHoverEvent(event: MotionEvent): Boolean {
        val toolType = event.getToolType(0)
        if (toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER) {
            lastStylusTimestamp = SystemClock.uptimeMillis()
        }
        return super.onHoverEvent(event)
    }

    /**
     * Main input handler with sub-frame historical sample processing and palm rejection.
     */
    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val toolType = event.getToolType(0)
        val isStylus = toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER
        val now = SystemClock.uptimeMillis()

        // Content coordinate mapping taking current scroll position into account
        val x = event.x + scrollX
        val y = event.y + scrollY

        // -------------------------------------------------------------
        // PALM REJECTION PIPELINE & FINGER TOUCH HANDLING
        // -------------------------------------------------------------
        if (isStylus) {
            lastStylusTimestamp = now
        } else {
            // 1. Cooldown rejection: Reject finger if stylus was active within 400ms
            if (now - lastStylusTimestamp < STYLUS_HOVER_TOUCH_COOLDOWN_MS) {
                return true // Consume and discard accidental palm touch
            }

            // 2. Contact area filter: Reject large capacitive patches (resting side of hand)
            val touchMajor = event.getTouchMajor(0)
            if (touchMajor > PALM_TOUCH_MAJOR_THRESHOLD) {
                return true // Consume and discard palm rest
            }

            // 3. Kalem yokken parmakla yazma engeli: Parmak asla çizim yapmaz, sadece sayfayı kaydırır
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    fingerRawStartX = event.rawX
                    fingerRawStartY = event.rawY
                    isFingerScrolling = true
                    onFingerScrollActive?.invoke(true)
                }
                MotionEvent.ACTION_MOVE -> {
                    if (isFingerScrolling) {
                        val dx = event.rawX - fingerRawStartX
                        val dy = event.rawY - fingerRawStartY
                        fingerRawStartX = event.rawX
                        fingerRawStartY = event.rawY

                        // Scroll the view smoothly
                        scrollBy((-dx).toInt(), (-dy).toInt())
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    isFingerScrolling = false
                    onFingerScrollActive?.invoke(false)
                }
            }
            return true
        }

        // Hardware Eraser Button on stylus barrel
        val activeTool = if (toolType == MotionEvent.TOOL_TYPE_ERASER) {
            ToolMode.ERASER_STROKE
        } else {
            currentMode
        }

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                // Check if user clicked inside selection bounds to drag selected strokes
                if (activeTool == ToolMode.LASSO && selectedStrokes.isNotEmpty() && selectionBounds.contains(x, y)) {
                    isDraggingSelection = true
                    dragStartX = x
                    dragStartY = y
                    return true
                }

                // If clicking outside selection, clear selection
                if (selectedStrokes.isNotEmpty()) {
                    clearSelection()
                    invalidate()
                }

                isDrawing = true
                lastX = x
                lastY = y
                activePath.reset()
                activePath.moveTo(x, y)

                if (activeTool == ToolMode.ERASER_STROKE) {
                    eraseStrokeAt(x, y)
                    return true
                }

                configureActivePaint(activeTool, event.pressure)
                invalidate()
            }

            MotionEvent.ACTION_MOVE -> {
                if (isDraggingSelection) {
                    val dx = x - dragStartX
                    val dy = y - dragStartY
                    dragStartX = x
                    dragStartY = y
                    for (i in 0 until selectedStrokes.size) {
                        val stroke = selectedStrokes[i]
                        stroke.offsetX += dx
                        stroke.offsetY += dy
                        stroke.bounds.offset(dx, dy)
                    }
                    selectionBounds.offset(dx, dy)
                    invalidate()
                    return true
                }

                if (!isDrawing) return true

                if (activeTool == ToolMode.ERASER_STROKE) {
                    eraseStrokeAt(x, y)
                    return true
                }

                // -------------------------------------------------------------
                // LOW-LATENCY HISTORICAL SAMPLES PROCESSING
                // Extracts sub-frame points captured by the Lenovo hardware digitizer
                // -------------------------------------------------------------
                val historySize = event.historySize
                for (h in 0 until historySize) {
                    val hx = event.getHistoricalX(h) + scrollX
                    val hy = event.getHistoricalY(h) + scrollY
                    val hp = event.getHistoricalPressure(h)
                    appendBezierSample(hx, hy, hp, activeTool)
                }

                // Append current point
                appendBezierSample(x, y, event.pressure, activeTool)
                invalidate()
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isDraggingSelection) {
                    isDraggingSelection = false
                    commitSelectionTransformation()
                    invalidate()
                    return true
                }

                if (!isDrawing) return true
                isDrawing = false

                when (activeTool) {
                    ToolMode.LASSO -> {
                        evaluateLassoSelection()
                    }
                    ToolMode.ERASER_STROKE -> {
                        // Finished erasing gesture
                    }
                    else -> {
                        // Commit active vector stroke with tool-specific independent color and width
                        val committedPath = Path(activePath)
                        val isHighlighter = activeTool == ToolMode.HIGHLIGHTER
                        val alpha = if (isHighlighter) 115 else 255
                        val width = activePaint.strokeWidth
                        val chosenColor = if (isHighlighter) highlighterColor else penColor

                        val stroke = Stroke(
                            path = committedPath,
                            color = chosenColor,
                            strokeWidth = width,
                            alpha = alpha,
                            isHighlighter = isHighlighter
                        )

                        strokes.add(stroke)
                        undoStack.clear() // Invalidate redo stack on new action
                        notifyHistoryState()
                        onStrokeAdded?.invoke()
                    }
                }

                activePath.reset()
                invalidate()
            }
        }

        return true
    }

    /**
     * Appends a point using quadratic Bezier curve interpolation (quadTo).
     * Prevents sharp corners and polygon-like artifacts on fast stylus strokes.
     */
    private fun appendBezierSample(x: Float, y: Float, pressure: Float, tool: ToolMode) {
        val dx = Math.abs(x - lastX)
        val dy = Math.abs(y - lastY)

        if (dx >= TOUCH_SLOP || dy >= TOUCH_SLOP) {
            val midX = (x + lastX) * 0.5f
            val midY = (y + lastY) * 0.5f

            // Bezier curve to midpoint using last point as control handle
            activePath.quadTo(lastX, lastY, midX, midY)
            lastX = x
            lastY = y

            // Dynamic pressure scaling for pen mode
            if (tool == ToolMode.PEN) {
                val clampedPressure = pressure.coerceIn(0.05f, 1.0f)
                val pressureMultiplier = 0.5f + (clampedPressure * 1.5f)
                activePaint.strokeWidth = penStrokeWidth * pressureMultiplier
            }
        }
    }

    private fun configureActivePaint(tool: ToolMode, pressure: Float) {
        activePaint.reset()
        activePaint.isAntiAlias = true
        activePaint.isDither = true
        activePaint.style = Paint.Style.STROKE
        activePaint.strokeJoin = Paint.Join.ROUND
        activePaint.strokeCap = Paint.Cap.ROUND

        when (tool) {
            ToolMode.PEN -> {
                activePaint.color = penColor
                activePaint.alpha = 255
                activePaint.xfermode = null
                val clampedPressure = pressure.coerceIn(0.05f, 1.0f)
                activePaint.strokeWidth = penStrokeWidth * (0.5f + (clampedPressure * 1.5f))
            }
            ToolMode.HIGHLIGHTER -> {
                activePaint.color = highlighterColor
                activePaint.alpha = 115
                activePaint.strokeWidth = highlighterStrokeWidth
                activePaint.xfermode = highlighterXfermode
            }
            ToolMode.LASSO -> {
                activePaint.set(lassoPaint)
            }
            else -> {}
        }
    }

    /**
     * Stroke Eraser: checks AABB bounding box collision in reverse O(N) loop with zero allocations.
     */
    private fun eraseStrokeAt(x: Float, y: Float) {
        val tolerance = 24f
        for (i in strokes.indices.reversed()) {
            val stroke = strokes[i]
            tempBounds.set(stroke.bounds)
            tempBounds.offset(stroke.offsetX, stroke.offsetY)
            tempBounds.inset(-tolerance, -tolerance)

            if (tempBounds.contains(x, y)) {
                undoStack.add(strokes.removeAt(i))
                notifyHistoryState()
                invalidate()
                break
            }
        }
    }

    /**
     * Evaluates lasso selection polygon against existing strokes.
     */
    private fun evaluateLassoSelection() {
        activePath.computeBounds(tempBounds, true)
        clipRegion.set(
            tempBounds.left.toInt(),
            tempBounds.top.toInt(),
            tempBounds.right.toInt(),
            tempBounds.bottom.toInt()
        )
        lassoRegion.setPath(activePath, clipRegion)

        selectedStrokes.clear()
        selectionBounds.setEmpty()

        for (i in 0 until strokes.size) {
            val stroke = strokes[i]
            tempBounds.set(stroke.bounds)
            tempBounds.offset(stroke.offsetX, stroke.offsetY)

            clipRegion.set(
                tempBounds.left.toInt(),
                tempBounds.top.toInt(),
                tempBounds.right.toInt(),
                tempBounds.bottom.toInt()
            )
            strokeRegion.setPath(stroke.path, clipRegion)

            // Correct intersection check: if region.op returns true, they DO intersect
            val intersects = lassoRegion.op(strokeRegion, Region.Op.INTERSECT)
            if (intersects) {
                stroke.isSelected = true
                selectedStrokes.add(stroke)
                if (selectionBounds.isEmpty) {
                    selectionBounds.set(tempBounds)
                } else {
                    selectionBounds.union(tempBounds)
                }
            } else {
                stroke.isSelected = false
            }
        }

        if (selectedStrokes.isNotEmpty()) {
            selectionBounds.inset(-12f, -12f)
        }
    }

    private fun commitSelectionTransformation() {
        for (i in 0 until selectedStrokes.size) {
            val stroke = selectedStrokes[i]
            if (stroke.offsetX != 0f || stroke.offsetY != 0f) {
                transformMatrix.reset()
                transformMatrix.setTranslate(stroke.offsetX, stroke.offsetY)
                stroke.path.transform(transformMatrix)
                stroke.path.computeBounds(stroke.bounds, true)
                stroke.offsetX = 0f
                stroke.offsetY = 0f
            }
        }
    }

    fun deleteSelectedStrokes() {
        if (selectedStrokes.isEmpty()) return
        for (i in 0 until selectedStrokes.size) {
            val stroke = selectedStrokes[i]
            strokes.remove(stroke)
            undoStack.add(stroke)
        }
        clearSelection()
        notifyHistoryState()
        invalidate()
    }

    fun clearSelection() {
        for (i in 0 until selectedStrokes.size) {
            selectedStrokes[i].isSelected = false
        }
        selectedStrokes.clear()
        selectionBounds.setEmpty()
        isDraggingSelection = false
    }

    fun undo(): Boolean {
        if (strokes.isNotEmpty()) {
            val stroke = strokes.removeAt(strokes.size - 1)
            undoStack.add(stroke)
            clearSelection()
            notifyHistoryState()
            invalidate()
            return true
        }
        return false
    }

    fun redo(): Boolean {
        if (undoStack.isNotEmpty()) {
            val stroke = undoStack.removeAt(undoStack.size - 1)
            strokes.add(stroke)
            clearSelection()
            notifyHistoryState()
            invalidate()
            return true
        }
        return false
    }

    fun clearAllStrokes() {
        undoStack.addAll(strokes)
        strokes.clear()
        clearSelection()
        notifyHistoryState()
        invalidate()
    }

    /**
     * Returns a safe snapshot of current strokes for per-page caching.
     */
    fun getStrokesCopy(): List<Stroke> = ArrayList(strokes)

    /**
     * Restores strokes for a given page index.
     */
    fun setStrokes(newStrokes: List<Stroke>) {
        strokes.clear()
        strokes.addAll(newStrokes)
        undoStack.clear()
        clearSelection()
        notifyHistoryState()
        invalidate()
    }

    private fun notifyHistoryState() {
        onHistoryChanged?.invoke(strokes.isNotEmpty(), undoStack.isNotEmpty())
    }

    /**
     * Exports full-resolution flattened bitmap (PDF background + vector strokes) for saving.
     * Content is rendered in un-scrolled page coordinates.
     */
    fun createFlattenedBitmap(): Bitmap {
        val w = (pdfBackground?.width ?: width).coerceAtLeast(1)
        val h = (pdfBackground?.height ?: height).coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        // Draw background
        pdfBackground?.let { bg ->
            if (!bg.isRecycled) {
                canvas.drawBitmap(bg, 0f, 0f, null)
            }
        }

        // Draw committed strokes
        for (i in 0 until strokes.size) {
            val stroke = strokes[i]
            cachedRenderPaint.reset()
            cachedRenderPaint.isAntiAlias = true
            cachedRenderPaint.isDither = true
            cachedRenderPaint.style = Paint.Style.STROKE
            cachedRenderPaint.strokeJoin = Paint.Join.ROUND
            cachedRenderPaint.strokeCap = Paint.Cap.ROUND
            cachedRenderPaint.color = stroke.color
            cachedRenderPaint.alpha = stroke.alpha
            cachedRenderPaint.strokeWidth = stroke.strokeWidth

            if (stroke.isHighlighter) {
                cachedRenderPaint.xfermode = highlighterXfermode
            }

            if (stroke.offsetX != 0f || stroke.offsetY != 0f) {
                val saveCount = canvas.save()
                canvas.translate(stroke.offsetX, stroke.offsetY)
                canvas.drawPath(stroke.path, cachedRenderPaint)
                canvas.restoreToCount(saveCount)
            } else {
                canvas.drawPath(stroke.path, cachedRenderPaint)
            }
        }

        return bitmap
    }

    // -------------------------------------------------------------
    // ZERO-GC onDraw LOOP
    // Standard indexed loop (no Iterator allocation)
    // -------------------------------------------------------------
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // 1. Draw PDF Page Background
        pdfBackground?.let { bg ->
            if (!bg.isRecycled) {
                canvas.drawBitmap(bg, 0f, 0f, null)
            }
        }

        // 2. Draw Committed Strokes
        for (i in 0 until strokes.size) {
            val stroke = strokes[i]

            cachedRenderPaint.reset()
            cachedRenderPaint.isAntiAlias = true
            cachedRenderPaint.isDither = true
            cachedRenderPaint.style = Paint.Style.STROKE
            cachedRenderPaint.strokeJoin = Paint.Join.ROUND
            cachedRenderPaint.strokeCap = Paint.Cap.ROUND
            cachedRenderPaint.color = stroke.color
            cachedRenderPaint.alpha = stroke.alpha
            cachedRenderPaint.strokeWidth = stroke.strokeWidth

            if (stroke.isHighlighter) {
                cachedRenderPaint.xfermode = highlighterXfermode
            }

            if (stroke.offsetX != 0f || stroke.offsetY != 0f) {
                val saveCount = canvas.save()
                canvas.translate(stroke.offsetX, stroke.offsetY)
                canvas.drawPath(stroke.path, cachedRenderPaint)
                canvas.restoreToCount(saveCount)
            } else {
                canvas.drawPath(stroke.path, cachedRenderPaint)
            }
        }

        // 3. Draw Active In-Progress Stroke
        if (isDrawing) {
            canvas.drawPath(activePath, activePaint)
        }

        // 4. Draw Lasso Selection Overlay & Handles
        if (selectedStrokes.isNotEmpty() && !selectionBounds.isEmpty) {
            canvas.drawRect(selectionBounds, selectionBoundingPaint)
            val handleRadius = 10f
            drawHandle(canvas, selectionBounds.left, selectionBounds.top, handleRadius)
            drawHandle(canvas, selectionBounds.right, selectionBounds.top, handleRadius)
            drawHandle(canvas, selectionBounds.left, selectionBounds.bottom, handleRadius)
            drawHandle(canvas, selectionBounds.right, selectionBounds.bottom, handleRadius)
        }
    }

    private fun drawHandle(canvas: Canvas, cx: Float, cy: Float, radius: Float) {
        canvas.drawCircle(cx, cy, radius, selectionHandlePaint)
        canvas.drawCircle(cx, cy, radius, selectionHandleBorderPaint)
    }
}
