package com.meshahid973.localitfy;

import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.wifi.WifiManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
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
    private WifiManager.WifiLock wifiLock;

    // The live connection: one server-sent-events stream from the computer, read on its own thread so it keeps
    // going while the page is in the background. It reconnects with a growing pause, and at once on a new network.
    private static final long[] LIVE_RETRY_MS = {1000, 2000, 5000, 10000, 30000};
    private final Object liveLock = new Object();
    private Thread liveThread;
    private boolean liveWanted = false;
    private boolean liveRetryNow = false;
    private String liveUrl = "";
    private String liveToken = "";
    private volatile HttpURLConnection liveConnection;
    private Network liveNetwork;
    private boolean watchingNetwork = false;

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
        downloads.execute(() -> {
            HttpURLConnection connection = null;
            File temp = null;
            try {
                File target = resolve(call.getString("path"));
                File parent = target.getParentFile();
                // Another download may create this shared directory between isDirectory() and mkdirs().
                if (parent != null && !parent.isDirectory() && !parent.mkdirs() && !parent.isDirectory()) throw new IOException("could not create folder");
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

    @PluginMethod
    public void liveConnect(PluginCall call) {
        String url = call.getString("url", "");
        String token = call.getString("token", "");
        synchronized (liveLock) {
            if (!url.equals(liveUrl) || !token.equals(liveToken)) closeLiveConnection();
            liveUrl = url;
            liveToken = token;
            liveWanted = true;
            wakeLive();
            if (liveThread == null) {
                liveThread = new Thread(this::runLive, "localtify-live");
                liveThread.setDaemon(true);
                liveThread.start();
            }
        }
        watchNetwork();
        call.resolve();
    }

    @PluginMethod
    public void liveDisconnect(PluginCall call) {
        synchronized (liveLock) {
            liveWanted = false;
            closeLiveConnection();
            wakeLive();
        }
        call.resolve();
    }

    /** Call holding liveLock: ends a backoff pause so the next attempt starts now. */
    private void wakeLive() {
        liveRetryNow = true;
        liveLock.notifyAll();
    }

    private void closeLiveConnection() {
        HttpURLConnection connection = liveConnection;
        liveConnection = null;
        if (connection != null) connection.disconnect();
    }

    private void emitLiveStatus(String status) {
        JSObject data = new JSObject();
        data.put("status", status);
        notifyListeners("liveStatus", data);
    }

    private void runLive() {
        int failures = 0;
        while (true) {
            String url;
            String token;
            synchronized (liveLock) {
                if (!liveWanted) {
                    liveThread = null;
                    return;
                }
                url = liveUrl;
                token = liveToken;
                liveRetryNow = false;
            }
            emitLiveStatus("connecting");
            HttpURLConnection connection = null;
            int status = 0;
            try {
                connection = (HttpURLConnection) new URL(url + "/v1/live").openConnection();
                liveConnection = connection;
                connection.setConnectTimeout(5000);
                // The computer sends a heartbeat every 25 s; a minute of silence means the link is gone.
                connection.setReadTimeout(60000);
                connection.setRequestProperty("Authorization", "Bearer " + token);
                connection.setRequestProperty("Accept", "text/event-stream");
                status = connection.getResponseCode();
                if (status == 200) {
                    failures = 0;
                    emitLiveStatus("connected");
                    readLiveEvents(connection.getInputStream(), url, token);
                }
            } catch (Exception ignored) {
                // Unreachable, dropped, or closed for a new address: try again below.
            } finally {
                if (connection != null) connection.disconnect();
                if (liveConnection == connection) liveConnection = null;
            }
            synchronized (liveLock) {
                if (!liveWanted) continue;
                // 404: a computer from before the live connection. 401: this phone was unpaired there.
                if ((status == 404 || status == 401) && url.equals(liveUrl) && token.equals(liveToken)) {
                    liveWanted = false;
                    emitLiveStatus(status == 404 ? "unsupported" : "unpaired");
                    continue;
                }
                emitLiveStatus("offline");
                if (!liveRetryNow) {
                    try {
                        liveLock.wait(LIVE_RETRY_MS[Math.min(failures, LIVE_RETRY_MS.length - 1)]);
                    } catch (InterruptedException interrupted) {
                        liveWanted = false;
                    }
                }
                failures += 1;
            }
        }
    }

    private void readLiveEvents(InputStream stream, String url, String token) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder data = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.isEmpty()) {
                if (data.length() == 0) continue;
                JSObject event = new JSObject();
                event.put("data", data.toString());
                notifyListeners("liveEvent", event);
                data.setLength(0);
            } else if (line.startsWith(":")) {
                pongLive(url, token);
            } else if (line.startsWith("data:")) {
                if (data.length() > 0) data.append('\n');
                data.append(line.startsWith("data: ") ? line.substring(6) : line.substring(5));
            }
        }
    }

    /** Answers the computer's heartbeat from here, so it keeps working with the page asleep in the background. */
    private void pongLive(String url, String token) {
        requests.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url + "/v1/live").openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("Authorization", "Bearer " + token);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write("{\"type\":\"pong\"}".getBytes(StandardCharsets.UTF_8));
                }
                connection.getResponseCode();
            } catch (Exception ignored) {
                // A missed pong only matters if the next ones fail too.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    /** Wi-Fi back after sleep, or a switch to another network: reconnect now rather than after the backoff. */
    private void watchNetwork() {
        synchronized (liveLock) {
            if (watchingNetwork) return;
            watchingNetwork = true;
        }
        ConnectivityManager manager = getContext().getSystemService(ConnectivityManager.class);
        if (manager == null) return;
        manager.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                synchronized (liveLock) {
                    // The first call reports the network already in use; only a different one makes the old socket stale.
                    if (liveNetwork != null && !liveNetwork.equals(network)) closeLiveConnection();
                    liveNetwork = network;
                    wakeLive();
                }
            }
        });
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
        intent.putExtra("shuffle", Boolean.TRUE.equals(call.getBoolean("shuffle", false)));
        intent.putExtra("repeat", call.getString("repeat", "off"));
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
