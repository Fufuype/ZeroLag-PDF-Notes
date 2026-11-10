# ProGuard Rules for ZeroLag Notes
# Aggressive size and runtime performance optimization for low-end ARM tablets

-dontwarn java.lang.invoke.**
-keepattributes SourceFile,LineNumberTable
-repackageclasses 'com.zerolag.opt'

# Preserve Jetpack Compose runtime internals
-keep class androidx.compose.** { *; }

# Preserve custom DrawingCanvasView constructor for XML / AndroidView inflation
-keepclasseswithmembers class com.zerolag.pdfnotes.DrawingCanvasView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Preserve native PDF classes
-keep class android.graphics.pdf.PdfRenderer { *; }
-keep class android.graphics.pdf.PdfDocument { *; }
