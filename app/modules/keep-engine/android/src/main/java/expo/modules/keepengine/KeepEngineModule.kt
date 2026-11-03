package expo.modules.keepengine

import android.content.Context
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.CookieManager
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.util.Collections
import java.util.concurrent.Executors

/**
 * On-device download engine.
 *
 * Wraps yt-dlp (with its bundled Python, QuickJS and ffmpeg) so the phone itself
 * fetches the media — no server needed. All work runs on one background thread,
 * which keeps downloads strictly sequential and stops an engine update from
 * swapping yt-dlp out from under a running download.
 */
class KeepEngineModule : Module() {
  private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "keep-engine") }
  private val cancelled = Collections.synchronizedSet(HashSet<String>())

  @Volatile private var ready = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext?.applicationContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("KeepEngine")

    Events("onProgress")

    /** Unpacks the runtime on first launch (a few seconds) and reports the yt-dlp version. */
    AsyncFunction("prepare") { promise: Promise ->
      worker.execute {
        try {
          ensureReady()
          promise.resolve(mapOf("version" to YoutubeDL.version(context)))
        } catch (e: Throwable) {
          promise.reject("ERR_PREPARE", startupError(e), e)
        }
      }
    }

    AsyncFunction("update") { promise: Promise ->
      worker.execute {
        try {
          ensureReady()
          val status = YoutubeDL.updateYoutubeDL(context, YoutubeDL.UpdateChannel.STABLE)
          promise.resolve(
            mapOf(
              "updated" to (status == YoutubeDL.UpdateStatus.DONE),
              "version" to YoutubeDL.version(context)
            )
          )
        } catch (e: Throwable) {
          promise.reject("ERR_UPDATE", e.message ?: "Update failed", e)
        }
      }
    }

    AsyncFunction("download") { id: String, url: String, kind: String, quality: String, cookies: String?, cookieDomain: String?, promise: Promise ->
      cancelled.remove(id)
      worker.execute {
        try {
          promise.resolve(runDownload(id, url, kind, quality, cookies, cookieDomain ?: ".youtube.com"))
        } catch (e: Throwable) {
          if (cancelled.remove(id) || e is YoutubeDL.CanceledException) {
            promise.reject("ERR_CANCELLED", "Cancelled", e)
          } else {
            promise.reject("ERR_DOWNLOAD", cleanError(e), e)
          }
        } finally {
          File(context.cacheDir, "keep-jobs/$id").deleteRecursively()
        }
      }
    }

    // Android 10+ can add our own files to the shared gallery without requesting
    // broad access to the user's existing photos and videos.
    AsyncFunction("saveToGallery") { uri: String, promise: Promise ->
      worker.execute {
        var destination: Uri? = null
        try {
          check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { "Requires Android 10 or later" }
          val parsed = Uri.parse(uri)
          require(parsed.scheme == "file") { "Expected a local file" }
          val source = File(requireNotNull(parsed.path)).canonicalFile
          val library = File(context.filesDir, "Keep").canonicalFile
          require(source.parentFile == library && source.isFile && source.length() > 0) { "Video file is missing" }
          val resolver = context.contentResolver
          val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, source.name)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Keep")
            put(MediaStore.Video.Media.IS_PENDING, 1)
          }
          destination = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Could not create the Gallery video")
          val output = resolver.openOutputStream(destination, "w")
            ?: throw IllegalStateException("Could not write the Gallery video")
          source.inputStream().use { input -> output.use { input.copyTo(it) } }
          val complete = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
          check(resolver.update(destination, complete, null, null) > 0) { "Could not finish saving to Gallery" }
          promise.resolve(true)
        } catch (e: Throwable) {
          destination?.let { runCatching { context.contentResolver.delete(it, null, null) } }
          promise.reject("ERR_GALLERY", e.message ?: "Could not save to Gallery", e)
        }
      }
    }

    Function("cancel") { id: String ->
      cancelled.add(id)
      YoutubeDL.destroyProcessById(id)
    }

    // ---- Account sessions (shared with the sign-in WebView) ----------------- //

    /** The cookie header for a service, or null when not signed in. */
    AsyncFunction("sessionCookies") { service: String ->
      val (url, markers) = when (service) {
        "youtube" -> "https://www.youtube.com" to listOf("SAPISID=", "__Secure-3PSID=", "LOGIN_INFO=")
        else -> "https://www.instagram.com" to listOf("sessionid=")
      }
      val header = CookieManager.getInstance().getCookie(url)
      val cookieNames = header?.split(";")?.mapNotNull { pair ->
        val name = pair.substringBefore("=").trim()
        name.takeIf { pair.contains("=") && pair.substringAfter("=").isNotBlank() }
      }.orEmpty()
      if (markers.any { it.removeSuffix("=") in cookieNames }) header else null
    }.runOnQueue(Queues.MAIN)

    /** Signs out of one service only, by expiring its cookies. */
    AsyncFunction("signOut") { service: String, promise: Promise ->
      val cm = CookieManager.getInstance()
      val targets = when (service) {
        "youtube" -> listOf("https://www.youtube.com" to ".youtube.com", "https://accounts.google.com" to ".google.com")
        else -> listOf("https://www.instagram.com" to ".instagram.com")
      }
      for ((url, domain) in targets) {
        val names = cm.getCookie(url)?.split(";")?.map { it.substringBefore("=").trim() }?.filter { it.isNotEmpty() }
        names?.forEach { name ->
          val expired = "$name=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Secure"
          cm.setCookie(url, expired)
          cm.setCookie(url, "$expired; Domain=$domain")
        }
      }
      cm.flush()
      promise.resolve(true)
    }.runOnQueue(Queues.MAIN)
  }

  // ------------------------------------------------------------------------ //

  @Synchronized
  private fun ensureReady() {
    if (ready) return
    try {
      YoutubeDL.init(context)
    } catch (e: Throwable) {
      throw IllegalStateException("Python and yt-dlp initialization failed", e)
    }
    try {
      FFmpeg.init(context)
    } catch (e: Throwable) {
      throw IllegalStateException("FFmpeg initialization failed", e)
    }
    ready = true
  }

  private fun emit(id: String, phase: String, progress: Double, speed: Double? = null, eta: Long? = null) {
    sendEvent(
      "onProgress",
      mapOf("id" to id, "phase" to phase, "progress" to progress, "speed" to speed, "eta" to eta)
    )
  }

  private fun baseRequest(url: String?, kind: String, quality: String, cookieFile: File?): YoutubeDLRequest {
    val req = if (url == null) YoutubeDLRequest(emptyList<String>()) else YoutubeDLRequest(url)
    req.addOption("--ignore-config")
    req.addOption("--verbose")
    req.addOption("--no-colors")
    // The wrapper otherwise disables caching, refetching EJS scripts every time.
    req.addOption("--cache-dir", File(context.cacheDir, "keep-engine-cache").absolutePath)
    req.addOption("--no-playlist")
    req.addOption("--no-mtime")
    req.addOption("--socket-timeout", 30)
    req.addOption("--retries", 5)
    req.addOption("--fragment-retries", 5)
    req.addOption("--remote-components", "ejs:github")
    if (cookieFile != null) req.addOption("--cookies", cookieFile.absolutePath)

    if (kind == "audio") {
      req.addOption("-f", "ba/b")
      req.addOption("-S", "acodec:m4a")
    } else {
      // H.264 + AAC plays everywhere on Android; resolution is the cap the user picked.
      req.addOption("-f", "bv*+ba/b")
      val res = if (quality == "best") "" else ",res:$quality"
      req.addOption("-S", "vcodec:h264$res,acodec:m4a")
    }
    return req
  }

  private fun runDownload(
    id: String,
    url: String,
    kind: String,
    quality: String,
    cookies: String?,
    cookieDomain: String
  ): Map<String, Any?> {
    emit(id, "preparing", 0.0)
    ensureReady()

    val jobDir = File(context.cacheDir, "keep-jobs/$id").apply {
      deleteRecursively()
      mkdirs()
    }
    val cookieFile = cookies?.let { writeCookieFile(jobDir, it, cookieDomain) }

    // 1. Metadata — gives the UI a title and thumbnail straight away, and tells us
    //    how many streams (video + audio) will be fetched so progress is honest.
    val infoReq = baseRequest(url, kind, quality, cookieFile).addOption("--dump-json")
    val infoOut = YoutubeDL.execute(infoReq, id, false, null).out
    if (cancelled.contains(id)) throw YoutubeDL.CanceledException()
    val info = infoOut.lineSequence().firstOrNull { it.trimStart().startsWith("{") }?.let { JSONObject(it) }
      ?: throw IllegalStateException("The engine returned no video metadata")
    val parts = info?.optJSONArray("requested_formats")?.length()?.coerceAtLeast(1) ?: 1
    val meta = mapOf(
      "title" to info?.optStringOrNull("title"),
      "thumbnail" to info?.optStringOrNull("thumbnail"),
      "uploader" to (info?.optStringOrNull("uploader") ?: info?.optStringOrNull("channel")),
      "duration" to info?.optDouble("duration")?.takeUnless { it.isNaN() }
    )
    sendEvent("onProgress", mapOf("id" to id, "phase" to "downloading", "progress" to 0.0) + meta)

    // 2. Download.
    // Reuse the extraction, including selected formats and request headers.
    // Extracting again doubles requests and repeats YouTube's JS challenges.
    val infoFile = File(jobDir, "info.json").apply { writeText(info.toString()) }
    val outputFile = File(jobDir, "output-path.txt")
    val req = baseRequest(null, kind, quality, cookieFile)
    req.addOption("--load-info-json", infoFile.absolutePath)
    req.addCommands(listOf("--print-to-file", "after_move:filepath", outputFile.absolutePath))
    req.addOption("--restrict-filenames")
    req.addOption("-o", "${jobDir.absolutePath}/%(title).80B [%(id)s].%(ext)s")
    if (kind == "audio") {
      req.addOption("-x")
      req.addOption("--audio-format", "m4a")
      req.addOption("--embed-metadata")
    } else {
      req.addOption("--merge-output-format", "mp4")
      req.addOption("--remux-video", "mp4")
    }

    val speedRe = Regex("""at\s+([\d.]+)\s*([KMG]?i?B)/s""")
    var part = -1
    var lastEmit = 0L
    var lastPhase = ""
    YoutubeDL.execute(req, id, false) { pct, eta, line ->
      if (line.startsWith("[download] Destination:")) part = (part + 1).coerceAtMost(parts - 1)
      val processing = line.startsWith("[Merger]") || line.startsWith("[ExtractAudio]") ||
        line.startsWith("[VideoRemuxer]") || line.startsWith("[Fixup") || line.startsWith("[Metadata]")
      val phase = if (processing) "processing" else "downloading"
      val now = System.currentTimeMillis()
      if (phase == lastPhase && now - lastEmit < 300) return@execute
      lastEmit = now
      lastPhase = phase
      if (processing) {
        emit(id, phase, 1.0)
      } else if (pct >= 0) {
        val overall = (part.coerceAtLeast(0) + pct / 100.0) / parts
        val speed = speedRe.find(line)?.let { m -> toBytes(m.groupValues[1], m.groupValues[2]) }
        emit(id, phase, overall.coerceIn(0.0, 1.0), speed, eta.takeIf { it >= 0 })
      }
    }
    if (cancelled.contains(id)) throw YoutubeDL.CanceledException()

    // 3. Move the finished file into the app's library folder.
    // Never select the largest file: a cookie jar or metadata file is not media.
    val produced = outputFile.takeIf { it.isFile }?.readLines()?.lastOrNull { it.isNotBlank() }
      ?.let { File(it).canonicalFile }
      ?: throw IllegalStateException("Download completed without a final media path")
    check(produced.parentFile == jobDir.canonicalFile && produced.isFile && produced.length() > 0) {
      "Download completed without a valid media file"
    }

    val library = File(context.filesDir, "Keep").apply { mkdirs() }
    var target = File(library, produced.name)
    var n = 1
    while (target.exists()) target = File(library, "${produced.nameWithoutExtension} ($n).${produced.extension}").also { n++ }
    if (!produced.renameTo(target)) {
      produced.copyTo(target, overwrite = true)
      produced.delete()
    }

    return meta + mapOf(
      "uri" to "file://${target.absolutePath}",
      "size" to target.length().toDouble()
    )
  }

  /** Converts a WebView cookie header into the Netscape file yt-dlp reads. */
  private fun writeCookieFile(dir: File, header: String, domain: String): File {
    val expiry = 0 // Preserve session semantics; do not invent a one-year lifetime.
    val host = "www" + domain // e.g. www.youtube.com, for host-only __Host- cookies
    val lines = header.split(";").mapNotNull { pair ->
      val i = pair.indexOf('=')
      if (i <= 0) return@mapNotNull null
      val name = pair.substring(0, i).trim()
      val value = pair.substring(i + 1).trim()
      if (name.startsWith("__Host-")) "$host\tFALSE\t/\tTRUE\t$expiry\t$name\t$value"
      else "$domain\tTRUE\t/\tTRUE\t$expiry\t$name\t$value"
    }
    return File(dir, "cookies.txt").apply {
      writeText("# Netscape HTTP Cookie File\n" + lines.joinToString("\n") + "\n")
    }
  }

  private fun toBytes(value: String, unit: String): Double? {
    val v = value.toDoubleOrNull() ?: return null
    val mult = when (unit.firstOrNull()) {
      'K' -> 1024.0
      'M' -> 1024.0 * 1024
      'G' -> 1024.0 * 1024 * 1024
      else -> 1.0
    }
    return v * mult
  }

  private fun startupError(error: Throwable): String {
    // Startup has no media URL or session cookies. Preserve causes because the
    // wrapper often reports only "failed to initialize" at the outer layer.
    val causes = generateSequence(error) { it.cause }.take(8).joinToString("\nCaused by: ") {
      "${it.javaClass.name}: ${it.message ?: "No message"}"
    }
    val libs = listOf("libpython.zip.so", "libffmpeg.zip.so", "libpython.so", "libffmpeg.so", "libqjs.so")
      .joinToString(", ") { name ->
        val file = File(context.applicationInfo.nativeLibraryDir, name)
        "$name=${if (file.isFile) file.length().toString() else "missing"}"
      }
    return "Android ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT}); " +
      "ABIs ${android.os.Build.SUPPORTED_ABIS.joinToString()}; " +
      "free storage ${context.filesDir.usableSpace / 1048576} MB\n$libs\n$causes\n" +
      android.util.Log.getStackTraceString(error).take(9000)
  }

  private fun cleanError(e: Throwable): String {
    // Keep warnings and traceback context; a lone last line can be meaningless.
    // Do not expose cookies or signed media URLs in copyable diagnostics.
    val raw = generateSequence(e) { it.cause }.take(8).joinToString("\nCaused by: ") {
      "${it.javaClass.simpleName}: ${it.message ?: "No message"}"
    }
    val safe = raw.replace(Regex("\u001B\\[[0-9;]*m"), "")
      .lineSequence().filterNot { line ->
        listOf("cookie:", "authorization:", "set-cookie:").any { line.contains(it, ignoreCase = true) }
      }.joinToString("\n")
      .replace(Regex("https?://[^\\s]+"), "[URL removed]")
      .replace(Regex("(?i)(sessionid|sapisid|__secure-[^=\\s]+|po_token)=([^\\s;]+)"), "$1=[redacted]")
    return "yt-dlp ${runCatching { YoutubeDL.version(context) }.getOrNull() ?: "unknown"}\n" + safe.takeLast(12000)
  }

  private fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) optString(key).takeIf { it.isNotBlank() } else null
}
