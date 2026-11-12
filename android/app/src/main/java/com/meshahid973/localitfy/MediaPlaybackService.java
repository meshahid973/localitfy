package com.meshahid973.localitfy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import java.io.File;

/**
 * Keeps the app process alive while music plays with the screen off, and owns the system media session.
 * Audio itself stays in the WebView; every control is forwarded to the renderer's mediaSession handlers.
 */
public class MediaPlaybackService extends Service {
    static final String ACTION_UPDATE = "localtify.media.UPDATE";
    private static final String ACTION_CONTROL = "localtify.media.CONTROL";
    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 1;
    private static volatile boolean running = false;

    private MediaSessionCompat session;
    private String artworkPath = "";
    private Bitmap artwork;
    private boolean foreground = false;
    private boolean noisyRegistered = false;
    private boolean shuffle = false;
    private String repeat = "off";

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            LocaltifyNativePlugin.emitMediaAction("pause", -1);
        }
    };

    static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        session = new MediaSessionCompat(this, "localtify");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { LocaltifyNativePlugin.emitMediaAction("play", -1); }
            @Override public void onPause() { LocaltifyNativePlugin.emitMediaAction("pause", -1); }
            @Override public void onSkipToNext() { LocaltifyNativePlugin.emitMediaAction("nexttrack", -1); }
            @Override public void onSkipToPrevious() { LocaltifyNativePlugin.emitMediaAction("previoustrack", -1); }
            @Override public void onStop() { LocaltifyNativePlugin.emitMediaAction("stop", -1); }
            @Override public void onSeekTo(long position) { LocaltifyNativePlugin.emitMediaAction("seekto", position / 1000.0); }
            // Shuffle and repeat buttons: the app flips its own setting, then reports the new state back.
            @Override public void onCustomAction(String action, Bundle extras) {
                if ("shuffle".equals(action) || "repeat".equals(action)) LocaltifyNativePlugin.emitMediaAction(action, -1);
            }
        });
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE));
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_CONTROL.equals(intent.getAction())) {
            LocaltifyNativePlugin.emitMediaAction(intent.getStringExtra("action"), -1);
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_UPDATE.equals(intent.getAction())) update(intent);
        return START_NOT_STICKY;
    }

    private void update(Intent intent) {
        String state = intent.getStringExtra("state");
        boolean playing = "playing".equals(state);
        long position = Math.round(intent.getDoubleExtra("position", 0) * 1000);
        long duration = Math.round(intent.getDoubleExtra("duration", 0) * 1000);
        float rate = (float) intent.getDoubleExtra("rate", 1);
        shuffle = intent.getBooleanExtra("shuffle", false);
        repeat = intent.getStringExtra("repeat") == null ? "off" : intent.getStringExtra("repeat");

        String nextArtwork = intent.getStringExtra("artwork");
        if (nextArtwork == null) nextArtwork = "";
        if (!nextArtwork.equals(artworkPath)) {
            artworkPath = nextArtwork;
            artwork = null;
            if (!artworkPath.isEmpty() && new File(artworkPath).isFile()) {
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 2;
                artwork = BitmapFactory.decodeFile(artworkPath, options);
            }
        }
        session.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, intent.getStringExtra("title"))
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, intent.getStringExtra("artist"))
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, intent.getStringExtra("album"))
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration > 0 ? duration : -1)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
            .build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO | PlaybackStateCompat.ACTION_STOP)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : "none".equals(state) ? PlaybackStateCompat.STATE_NONE : PlaybackStateCompat.STATE_PAUSED,
                position, playing ? rate : 0f, SystemClock.elapsedRealtime())
            // Android 13+ builds the notification and lock screen controls from these, after previous/play/next.
            .addCustomAction(new PlaybackStateCompat.CustomAction.Builder("shuffle", shuffle ? "Turn shuffle off" : "Turn shuffle on", shuffleIcon()).build())
            .addCustomAction(new PlaybackStateCompat.CustomAction.Builder("repeat", repeatLabel(), repeatIcon()).build())
            .build());
        session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE);
        session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE
            : "all".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ALL : PlaybackStateCompat.REPEAT_MODE_NONE);

        if (playing && !noisyRegistered) {
            registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
            noisyRegistered = true;
        } else if (!playing && noisyRegistered) {
            unregisterReceiver(noisy);
            noisyRegistered = false;
        }

        if ("none".equals(state)) {
            stopForegroundCompat(true);
            stopSelf();
            return;
        }
        Notification notification = buildNotification(intent.getStringExtra("title"), intent.getStringExtra("artist"), playing);
        if (playing) {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
                foreground = true;
            } catch (RuntimeException notAllowed) {
                // Android 12+ may refuse while the app is in the background, e.g. when the computer it is a remote for
                // starts playing. Show the controls as a plain notification instead of crashing.
                getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification);
            }
        } else {
            // Paused: keep the controls but let the system reclaim the process if it needs to.
            stopForegroundCompat(false);
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification);
        }
    }

    private void stopForegroundCompat(boolean removeNotification) {
        if (!foreground && !removeNotification) return;
        ServiceCompat.stopForeground(this, removeNotification ? ServiceCompat.STOP_FOREGROUND_REMOVE : ServiceCompat.STOP_FOREGROUND_DETACH);
        foreground = false;
    }

    private int shuffleIcon() {
        return shuffle ? R.drawable.ic_media_shuffle_on : R.drawable.ic_media_shuffle;
    }

    private int repeatIcon() {
        return "one".equals(repeat) ? R.drawable.ic_media_repeat_one_on : "all".equals(repeat) ? R.drawable.ic_media_repeat_on : R.drawable.ic_media_repeat;
    }

    private String repeatLabel() {
        return "off".equals(repeat) ? "Repeat all" : "all".equals(repeat) ? "Repeat one" : "Turn repeat off";
    }

    private PendingIntent control(String action, int code) {
        Intent intent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_CONTROL).putExtra("action", action);
        return PendingIntent.getService(this, code, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification buildNotification(String title, String artist, boolean playing) {
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_localtify)
            .setContentTitle(title)
            .setContentText(artist)
            .setLargeIcon(artwork)
            .setContentIntent(session.getController().getSessionActivity())
            .setDeleteIntent(control("stop", 4))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            // Older Android shows these actions; the collapsed view keeps previous, play and next.
            .addAction(shuffleIcon(), shuffle ? "Turn shuffle off" : "Turn shuffle on", control("shuffle", 5))
            .addAction(android.R.drawable.ic_media_previous, "Previous", control("previoustrack", 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pause" : "Play", control(playing ? "pause" : "play", 2))
            .addAction(android.R.drawable.ic_media_next, "Next", control("nexttrack", 3))
            .addAction(repeatIcon(), repeatLabel(), control("repeat", 6))
            .setStyle(new MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(1, 2, 3))
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Swiping the app away while paused ends the session; while playing, the music keeps going.
        if (!foreground) stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        if (noisyRegistered) unregisterReceiver(noisy);
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
