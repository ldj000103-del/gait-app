package io.github.ldj000103.gaitapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.TriggerEvent;
import android.hardware.TriggerEventListener;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// 걷기 자동 측정 (선택 기능, 민원 10/30·법률 검토 29번): 켜 두면 이 포그라운드 서비스가 '큰 움직임' 센서(저전력, 화면이 꺼져도 휴대폰을 깨움)를 기다리다가
// 움직이면 가속도를 50Hz로 재고, 30초 동안 흔들림이 없으면 끝내 auto/시작시각.bin 파일로 남김 → 앱을 열면 app.js가 걷기인지 분석해 '자동' 기록으로 넣음
// 위치(GPS·와이파이·기지국)와 기압계는 쓰지 않음. 손으로 재는 측정(GaitService) 중에는 쉼. 알림의 '끄기'나 설정에서 끄면 바로 멈춤
public class AutoService extends Service implements SensorEventListener {
    static final String DIR = "auto", ACTION_OFF = "auto.OFF", PREFS = "auto";
    static final long STILL_END_MS = 30 * 1000L, MIN_KEEP_MS = 20 * 1000L, MAX_MS = 60 * 60 * 1000L;   // 30초 가만히 = 끝, 20초 미만 움직임은 버림, 한 기록 최대 1시간
    static final long MAX_DIR_BYTES = 60L << 20;           // 앱을 오래 안 열어도 파일이 60MB를 넘지 않게 (넘으면 오래된 것부터 지움)
    static volatile boolean running = false;
    private SensorManager sm;
    private Sensor sig;
    private PowerManager.WakeLock wl;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<double[]> buf = new ArrayList<>();
    private boolean rec = false;
    private long recWall, recStart, lastMove, wStart;
    private double wSum, wSq; private int wN;
    private final TriggerEventListener trig = new TriggerEventListener() {
        @Override public void onTrigger(TriggerEvent e) { startRec(); }
    };
    private final Runnable check = this::check;

    static boolean isOn(Context c) { return c.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("on", false); }
    static void setOn(Context c, boolean on) { c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", on).apply(); }
    static boolean supported(Context c) { return c.getSystemService(SensorManager.class).getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION) != null; }
    static File dir(Context c) { File d = new File(c.getFilesDir(), DIR); d.mkdirs(); return d; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("auto", "걷기 자동 측정", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent off = PendingIntent.getService(this, 5, new Intent(this, AutoService.class).setAction(ACTION_OFF), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, "auto")
                .setContentTitle("걷기 자동 측정 켜짐")
                .setContentText("걸으면 저절로 재요 · 위치는 쓰지 않아요")
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentIntent(open).setOngoing(true)
                .addAction(0, "끄기", off)
                .build();
        ServiceCompat.startForeground(this, 4, n, Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH : 0);
        if (ACTION_OFF.equals(intent != null ? intent.getAction() : null)) setOn(this, false);   // 알림 '끄기'
        if (!isOn(this)) { stopSelf(); return START_NOT_STICKY; }
        if (!running) {
            running = true;
            sm = getSystemService(SensorManager.class);
            sig = sm.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION);
            if (sig == null) { setOn(this, false); stopSelf(); return START_NOT_STICKY; }   // 이 센서가 없는 휴대폰은 못 씀 (앱이 '지원 안 함'으로 알림)
            arm();
        }
        return START_STICKY;                                                   // 휴대폰이 정리해도 다시 띄움 (켜 둔 동안)
    }

    private void arm() { if (running && sig != null) sm.requestTriggerSensor(trig, sig); }   // 한 번 울리면 꺼지는 센서라 기록이 끝날 때마다 다시 걸어 둠

    private void startRec() {
        if (rec || !running) return;
        if (GaitService.running) { handler.postDelayed(this::arm, 60 * 1000L); return; }   // 손으로 재는 중: 1분 뒤 다시 기다림
        rec = true; buf.clear();
        recWall = System.currentTimeMillis(); recStart = lastMove = wStart = SystemClock.elapsedRealtime(); wSum = wSq = 0; wN = 0;
        wl = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gait:auto");
        wl.acquire(MAX_MS + 60 * 1000L);
        sm.registerListener(this, sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER), 20000);   // 50Hz, 손으로 잴 때와 같음
        handler.postDelayed(check, 5000);
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        buf.add(new double[]{e.timestamp / 1e6, e.values[0], e.values[1], e.values[2]});
        double m = Math.sqrt(e.values[0] * e.values[0] + e.values[1] * e.values[1] + e.values[2] * e.values[2]);
        wSum += m; wSq += m * m; wN++;
        long now = SystemClock.elapsedRealtime();
        if (now - wStart >= 5000) {                                          // 5초마다 흔들림 세기 (GaitService와 같은 기준)
            double mean = wSum / wN, sd = Math.sqrt(Math.max(0, wSq / wN - mean * mean));
            if (sd >= GaitService.STILL_SD) lastMove = now;
            wSum = wSq = 0; wN = 0; wStart = now;
        }
    }

    private void check() {
        if (!rec) return;
        long now = SystemClock.elapsedRealtime();
        if (GaitService.running) endRec(false);                              // 손으로 재기 시작함 → 이 기록은 버림
        else if (now - lastMove >= STILL_END_MS || now - recStart >= MAX_MS) endRec(true);
        else handler.postDelayed(check, 5000);
    }

    private void endRec(boolean keep) {
        handler.removeCallbacks(check);
        sm.unregisterListener(this);
        rec = false;
        if (keep && lastMove - recStart >= MIN_KEEP_MS && !buf.isEmpty()) {
            double cut = buf.get(buf.size() - 1)[0] - (SystemClock.elapsedRealtime() - lastMove);   // 끝의 가만히 있던 부분은 뺌
            write(cut);
        }
        buf.clear();
        if (wl != null && wl.isHeld()) wl.release();
        arm();
    }

    private void write(double cut) {
        File f = new File(dir(this), recWall + ".bin");
        try (DataOutputStream o = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(f)))) {
            for (double[] r : buf) { if (r[0] > cut) break; for (double v : r) o.writeDouble(v); }
        } catch (IOException e) { f.delete(); return; }
        File[] all = dir(this).listFiles();
        if (all == null) return;
        Arrays.sort(all, (a, b) -> a.getName().compareTo(b.getName()));
        long total = 0; for (File x : all) total += x.length();
        for (int i = 0; total > MAX_DIR_BYTES && i < all.length - 1; i++) { total -= all[i].length(); all[i].delete(); }
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacksAndMessages(null);
        if (sm != null) { if (sig != null) sm.cancelTriggerSensor(trig, sig); sm.unregisterListener(this); }
        if (wl != null && wl.isHeld()) wl.release();
        buf.clear(); rec = false;                                             // 끄면 재던 기록도 남기지 않음 (끄면 그 즉시 멈춤)
        super.onDestroy();
    }

    @Override public void onAccuracyChanged(Sensor s, int a) {}
    @Override public IBinder onBind(Intent i) { return null; }
}
