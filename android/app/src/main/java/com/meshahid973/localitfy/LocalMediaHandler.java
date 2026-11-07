package com.meshahid973.localitfy;

import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Serves synced audio and covers from app storage at https://localhost/_localtify_media_/<relative path>, with byte ranges. */
final class LocalMediaHandler {
    static final String PREFIX = "/_localtify_media_/";
    private final File root;

    LocalMediaHandler(File root) {
        this.root = root;
    }

    WebResourceResponse handle(WebResourceRequest request) {
        Uri url = request.getUrl();
        String path = url.getPath();
        if (!"localhost".equals(url.getHost()) || path == null || !path.startsWith(PREFIX)) return null;
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Accept-Ranges", "bytes");
        headers.put("Cache-Control", "no-cache");
        try {
            File file = new File(root, path.substring(PREFIX.length())).getCanonicalFile();
            if (!file.getPath().startsWith(root.getCanonicalPath() + File.separator) || !file.isFile()) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null);
            }
            long length = file.length();
            long start = 0;
            long end = length - 1;
            int status = 200;
            String reason = "OK";
            String range = request.getRequestHeaders().get("Range");
            if (range == null) range = request.getRequestHeaders().get("range");
            if (range != null && range.startsWith("bytes=")) {
                String[] parts = range.substring(6).split("-", 2);
                try {
                    if (parts[0].isEmpty()) {
                        start = Math.max(0, length - Long.parseLong(parts[1]));
                    } else {
                        start = Long.parseLong(parts[0]);
                        if (parts.length > 1 && !parts[1].isEmpty()) end = Math.min(end, Long.parseLong(parts[1]));
                    }
                } catch (NumberFormatException ignored) {
                    start = 0;
                }
                if (start > end || start >= length) {
                    headers.put("Content-Range", "bytes */" + length);
                    return new WebResourceResponse("text/plain", "utf-8", 416, "Range Not Satisfiable", headers, null);
                }
                status = 206;
                reason = "Partial Content";
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
            }
            headers.put("Content-Length", String.valueOf(end - start + 1));
            return new WebResourceResponse(mimeType(file.getName()), null, status, reason, headers, new RangeStream(file, start, end - start + 1));
        } catch (IOException error) {
            return new WebResourceResponse("text/plain", "utf-8", 500, "Error", headers, null);
        }
    }

    private static String mimeType(String name) {
        String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "mp3": return "audio/mpeg";
            case "m4a": case "aac": case "mp4": return "audio/mp4";
            case "opus": case "ogg": return "audio/ogg";
            case "flac": return "audio/flac";
            case "wav": return "audio/wav";
            case "webm": return "audio/webm";
            default:
                String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return type != null ? type : "application/octet-stream";
        }
    }

    private static final class RangeStream extends InputStream {
        private final RandomAccessFile file;
        private long remaining;

        RangeStream(File source, long start, long count) throws IOException {
            file = new RandomAccessFile(source, "r");
            file.seek(start);
            remaining = count;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int value = file.read();
            if (value >= 0) remaining--;
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) return -1;
            int count = file.read(buffer, offset, (int) Math.min(length, remaining));
            if (count > 0) remaining -= count;
            return count;
        }

        @Override
        public void close() throws IOException {
            file.close();
        }
    }
}
