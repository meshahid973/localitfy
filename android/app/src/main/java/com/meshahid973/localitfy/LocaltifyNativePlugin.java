package com.meshahid973.localitfy;

import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LocaltifyNative")
public class LocaltifyNativePlugin extends Plugin {
    private static LocaltifyNativePlugin active;
    private final ExecutorService requests = Executors.newFixedThreadPool(2);
    // A few files at once: one stream at a time leaves most of a Wi-Fi link idle.
    private final ExecutorService downloads = Executors.newFixedThreadPool(4);
    private volatile boolean cancelDownloads = false;
    private WifiManager.WifiLock wifiLock;

    @Override
    public void load() {
        active = this;
    }

    /** Media controls from the notification, lock screen or headset, forwarded to the renderer. */
    static void emitMediaAction(String action, double position) {
        LocaltifyNativePlugin plugin = active;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        if (position >= 0) data.put("position", position);
        plugin.notifyListeners("mediaAction", data);
    }

    @PluginMethod
    public void getPaths(PluginCall call) {
        JSObject result = new JSObject();
        result.put("files", getContext().getFilesDir().getAbsolutePath());
        result.put("mediaPrefix", "https://localhost" + LocalMediaHandler.PREFIX);
        result.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
        call.resolve(result);
    }

    private File resolve(String relative) throws IOException {
        File root = getContext().getFilesDir().getCanonicalFile();
        File file = new File(root, relative == null ? "" : relative).getCanonicalFile();
        if (!file.getPath().startsWith(root.getPath() + File.separator)) throw new IOException("path outside app storage");
        return file;
    }

    private static void applyHeaders(HttpURLConnection connection, JSObject headers) {
        if (headers == null) return;
        Iterator<String> keys = headers.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            connection.setRequestProperty(key, headers.optString(key));
        }
    }

    /** JSON requests to the Mac go through native code: the page itself may not call plain-HTTP LAN addresses. */
    @PluginMethod
    public void request(PluginCall call) {
        requests.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(call.getString("url")).openConnection();
                connection.setRequestMethod(call.getString("method", "GET"));
                connection.setConnectTimeout(call.getInt("timeoutMs", 8000));
                connection.setReadTimeout(call.getInt("timeoutMs", 30000));
                applyHeaders(connection, call.getObject("headers"));
                String body = call.getString("body");
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }
                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                if (stream != null) {
                    try (InputStream in = stream) {
                        byte[] chunk = new byte[16384];
                        int read;
                        while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
                    }
                }
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", buffer.toString("UTF-8"));
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage() == null ? "request failed" : error.getMessage(), "NETWORK");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    /** Streams one file to app storage (temp file, then rename) so a failed transfer never replaces a good copy. */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        cancelDownloads = false;
        downloads.execute(() -> {
            HttpURLConnection connection = null;
            File temp = null;
            try {
                if (cancelDownloads) throw new IOException("cancelled");
                File target = resolve(call.getString("path"));
                File parent = target.getParentFile();
                if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new IOException("could not create folder");
                temp = new File(parent, "." + target.getName() + ".part");
                connection = (HttpURLConnection) new URL(call.getString("url")).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(30000);
                applyHeaders(connection, call.getObject("headers"));
                int status = connection.getResponseCode();
                if (status != 200) throw new IOException("HTTP " + status);
                long total = connection.getContentLengthLong();
                long received = 0;
                long lastEvent = 0;
                String id = call.getString("id", "");
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
                    byte[] chunk = new byte[65536];
                    int read;
                    while ((read = in.read(chunk)) != -1) {
                        if (cancelDownloads) throw new IOException("cancelled");
                        out.write(chunk, 0, read);
                        received += read;
                        long now = System.currentTimeMillis();
                        if (now - lastEvent > 250) {
                            lastEvent = now;
                            JSObject progress = new JSObject();
                            progress.put("id", id);
                            progress.put("received", received);
                            progress.put("total", total);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                    out.getFD().sync();
                }
                if (total >= 0 && received != total) throw new IOException("incomplete download");
                if (!temp.renameTo(target)) throw new IOException("could not save file");
                JSObject result = new JSObject();
                result.put("bytes", received);
                call.resolve(result);
            } catch (Exception error) {
                if (temp != null) temp.delete();
                call.reject(error.getMessage() == null ? "download failed" : error.getMessage(), "DOWNLOAD");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void cancelDownloads(PluginCall call) {
        cancelDownloads = true;
        call.resolve();
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        try {
            File file = resolve(call.getString("path"));
            JSObject result = new JSObject();
            result.put("deleted", file.isFile() && file.delete());
            call.resolve(result);
        } catch (IOException error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        try {
            File folder = resolve(call.getString("path"));
            JSArray files = new JSArray();
            File[] entries = folder.listFiles();
            if (entries != null) {
                for (File entry : entries) {
                    if (!entry.isFile() || entry.getName().startsWith(".")) continue;
                    JSObject item = new JSObject();
                    item.put("name", entry.getName());
                    item.put("size", entry.length());
                    files.put(item);
                }
            }
            JSObject result = new JSObject();
            result.put("files", files);
            JSObject space = new JSObject();
            result.put("freeBytes", getContext().getFilesDir().getUsableSpace());
            call.resolve(result);
        } catch (IOException error) {
            call.reject(error.getMessage());
        }
    }

    /** Back with nowhere left to go: send the app to the background like other Android apps (music keeps playing). */
    @PluginMethod
    public void moveToBackground(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    /** Keeps Wi-Fi awake while a sync runs with the screen off. */
    @PluginMethod
    public void setSyncActive(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("active", false));
        if (wifiLock == null) {
            WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(android.content.Context.WIFI_SERVICE);
            if (wifi != null) wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "localtify:sync");
        }
        if (wifiLock != null) {
            if (on && !wifiLock.isHeld()) wifiLock.acquire();
            if (!on && wifiLock.isHeld()) wifiLock.release();
        }
        call.resolve();
    }

    /** Mirrors navigator.mediaSession into the native session and its foreground service. */
    @PluginMethod
    public void updateMedia(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_UPDATE);
        intent.putExtra("title", call.getString("title", ""));
        intent.putExtra("artist", call.getString("artist", ""));
        intent.putExtra("album", call.getString("album", ""));
        intent.putExtra("artwork", call.getString("artwork", ""));
        intent.putExtra("state", call.getString("state", "none"));
        intent.putExtra("position", call.getDouble("position", 0.0));
        intent.putExtra("duration", call.getDouble("duration", 0.0));
        intent.putExtra("rate", call.getDouble("rate", 1.0));
        String state = call.getString("state", "none");
        try {
            if ("playing".equals(state) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else if (MediaPlaybackService.isRunning()) {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "media update failed" : error.getMessage());
        }
    }
}
