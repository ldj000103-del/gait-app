package io.github.ldj000103.gaitapp;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

// 화면이 꺼져도 가속도·GPS를 계속 기록하는 포그라운드 서비스 (알림창에 "걸음 측정 중" 표시)
// 시각은 둘 다 부팅 후 경과 시간(ms)이라 JS에서 그대로 비교 가능
public class GaitService extends Service implements SensorEventListener, LocationListener {
    static final List<double[]> ACC = new ArrayList<>();   // t, x, y, z (중력 포함, m/s²)
    static final List<double[]> GPS = new ArrayList<>();   // t, lat, lon, accuracy(m)
    // 휴대폰이 앱 프로세스를 정리하면 위 메모리 값은 사라짐 → 10초마다 새 값만 앱 내부 파일에 덧붙여 두고, 끝낼 때 메모리가 비었으면 파일에서 읽음
    static final String ACC_FILE = "rec_acc.bin", GPS_FILE = "rec_gps.bin";
    static volatile boolean running = false;                // 이 프로세스에서 측정 중인지 (프로세스가 새로 뜨면 false)
    // 오래 걷지 않을 때 (민원팀 10/28, 아버님 병원 대기): 걷지 않는 상태가 IDLE_ASK 이어지면 진동·알림으로 물음 [끝내기][계속 재기],
    // 물은 뒤 IDLE_END 동안 답이 없거나 MAX_REC가 되면 지금까지 잰 것을 파일에 남기고 측정을 끝냄 → 앱을 열면 그 기록으로 저장 (기록은 버리지 않음)
    // app.js의 IDLE_ASK_S·IDLE_END_S·MAX_REC_S·STILL_SD와 같은 값 (데이터분석팀이 조정)
    static final long IDLE_ASK_MS = 15 * 60 * 1000L, IDLE_END_MS = 15 * 60 * 1000L, MAX_REC_MS = 3 * 3600 * 1000L;
    static final double STILL_SD = 0.6;                     // 5초 동안 가속도 크기의 흔들림(표준편차, m/s²)이 이보다 작으면 '걷지 않음'
    static final String END_FILE = "rec_end.txt", ACTION_END = "gait.END", ACTION_CONTINUE = "gait.CONTINUE";
    static volatile String endReason = null;                // idleEnd(답 없음) · maxEnd(3시간) · stop(알림에서 끝내기)
    private long startAt, lastMove, askedAt;
    private double wSum, wSq; private int wN; private long wStart;
    private int savedAcc = 0, savedGps = 0;
    private Runnable save;
    private static final String CHANNEL = "gait";
    private PowerManager.WakeLock wakeLock;
    private SensorManager sensors;
    private LocationManager location;
    // 슬로우 러닝: intervalSec마다 조깅/걷기 전환 진동 (조깅 = 길게 1번, 걷기 = 짧게 2번) + 알림 문구 변경
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable tick, endTick;
    private int phase = 0;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_CONTINUE.equals(action)) {                                // 알림 '계속 재기' → 다시 처음부터 셈
            lastMove = SystemClock.elapsedRealtime(); askedAt = 0;
            getSystemService(NotificationManager.class).cancel(2);
            return START_NOT_STICKY;
        }
        if (ACTION_END.equals(action)) { finishRec("stop"); return START_NOT_STICKY; }   // 알림 '끝내기'
        boolean useGps = intent != null && intent.getBooleanExtra("gps", false)
                && ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "걸음 측정", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setContentTitle("걸음 측정 중")
                .setContentText("끝내려면 앱을 열고 끝을 길게 누르세요")
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentIntent(open)
                .setOngoing(true)
                .build();
        int type = 0;
        if (Build.VERSION.SDK_INT >= 34) type = ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH | (useGps ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        else if (Build.VERSION.SDK_INT >= 29 && useGps) type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        ServiceCompat.startForeground(this, 1, n, type);

        synchronized (ACC) { ACC.clear(); }
        synchronized (GPS) { GPS.clear(); }
        clearFiles(this); savedAcc = savedGps = 0; running = true; endReason = null;
        startAt = lastMove = wStart = SystemClock.elapsedRealtime(); askedAt = 0; wSum = wSq = 0; wN = 0;
        save = () -> { savedAcc = append(ACC, ACC_FILE, savedAcc); savedGps = append(GPS, GPS_FILE, savedGps); checkIdle(); if (running) handler.postDelayed(save, 10000); };
        handler.postDelayed(save, 10000);
        // MAX_REC(3시간)가 되면 checkIdle이 측정을 끝내고 저장 (잠금은 여유 1분 두고 자동 해제)
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gait:rec");
        wakeLock.acquire(MAX_REC_MS + 60 * 1000L);
        sensors = getSystemService(SensorManager.class);
        sensors.registerListener(this, sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER), 20000);   // 20ms = 50Hz
        if (useGps) {
            location = getSystemService(LocationManager.class);
            location.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this, Looper.getMainLooper());
        }
        int intervalSec = intent != null ? intent.getIntExtra("intervalSec", 0) : 0;
        if (intervalSec > 0) {
            phase = 0;
            tick = () -> {
                phase++;
                boolean jog = phase % 2 == 0;
                Vibrator v = getSystemService(Vibrator.class);
                long[] pattern = jog ? new long[]{0, 600} : new long[]{0, 200, 150, 200};
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    else v.vibrate(pattern, -1);
                }
                nm.notify(1, new NotificationCompat.Builder(this, CHANNEL)
                        .setContentTitle(jog ? "조깅 1분" : "걷기 1분")
                        .setContentText("슬로우 러닝 측정 중 · 끝내려면 앱을 열고 끝을 누르세요")
                        .setSmallIcon(android.R.drawable.ic_menu_directions)
                        .setContentIntent(open).setOngoing(true).build());
                handler.postDelayed(tick, intervalSec * 1000L);
            };
            handler.postDelayed(tick, intervalSec * 1000L);
        }
        // 12분 달리기 테스트: endSec가 되면 길게 2번 진동 + 알림 (기록은 앱에서 끝을 누를 때까지 계속, 앱이 앞 12분만 씀)
        int endSec = intent != null ? intent.getIntExtra("endSec", 0) : 0;
        if (endSec > 0) {
            endTick = () -> {
                Vibrator v = getSystemService(Vibrator.class);
                long[] pattern = {0, 600, 200, 600};
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                    else v.vibrate(pattern, -1);
                }
                nm.notify(1, new NotificationCompat.Builder(this, CHANNEL)
                        .setContentTitle("12분 끝")
                        .setContentText("멈추고 앱을 열어 끝을 누르세요")
                        .setSmallIcon(android.R.drawable.ic_menu_directions)
                        .setContentIntent(open).setOngoing(true).build());
            };
            handler.postDelayed(endTick, endSec * 1000L);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        synchronized (ACC) { ACC.add(new double[]{e.timestamp / 1e6, e.values[0], e.values[1], e.values[2]}); }
        double m = Math.sqrt(e.values[0] * e.values[0] + e.values[1] * e.values[1] + e.values[2] * e.values[2]);
        wSum += m; wSq += m * m; wN++;
        long now = SystemClock.elapsedRealtime();
        if (now - wStart >= 5000) {                                          // 5초마다 흔들림 세기 → 걷고 있으면 lastMove 갱신
            double mean = wSum / wN, sd = Math.sqrt(Math.max(0, wSq / wN - mean * mean));
            if (sd >= STILL_SD) lastMove = now;
            wSum = wSq = 0; wN = 0; wStart = now;
        }
    }

    // 10초마다: 오래 걷지 않음 → 물음, 물은 뒤 답 없음·3시간 → 끝내고 저장. 다시 걸으면 물음을 거둠
    private void checkIdle() {
        if (!running) return;
        long now = SystemClock.elapsedRealtime();
        if (now - startAt >= MAX_REC_MS) { finishRec("maxEnd"); return; }
        if (askedAt > 0 && lastMove > askedAt) { askedAt = 0; getSystemService(NotificationManager.class).cancel(2); return; }
        if (askedAt > 0 && now - askedAt >= IDLE_END_MS) { finishRec("idleEnd"); return; }
        if (askedAt == 0 && now - lastMove >= IDLE_ASK_MS) { askedAt = now; ask(); }
    }

    private NotificationManager alertChannel() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("gait_alert", "걸음 측정 확인", NotificationManager.IMPORTANCE_HIGH));
        return nm;
    }
    private void buzz(long[] pattern) {
        Vibrator v = getSystemService(Vibrator.class);
        if (v == null) return;
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1)); else v.vibrate(pattern, -1);
    }
    private void ask() {
        buzz(new long[]{0, 400, 200, 400});
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent end = PendingIntent.getService(this, 1, new Intent(this, GaitService.class).setAction(ACTION_END), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent cont = PendingIntent.getService(this, 2, new Intent(this, GaitService.class).setAction(ACTION_CONTINUE), PendingIntent.FLAG_IMMUTABLE);
        alertChannel().notify(2, new NotificationCompat.Builder(this, "gait_alert")
                .setContentTitle(IDLE_ASK_MS / 60000 + "분째 걷지 않았어요")
                .setContentText("측정을 끝낼까요? " + IDLE_END_MS / 60000 + "분 동안 답이 없으면 지금까지 잰 것을 저장하고 끝내요")
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentIntent(open).setAutoCancel(true)
                .addAction(0, "끝내기", end).addAction(0, "계속 재기", cont)
                .build());
    }
    // 측정을 끝내고 지금까지 값을 파일에 남김 (메모리 값도 그대로라 앱이 stop()으로 가져감). 기록은 앱을 열 때 저장
    private void finishRec(String reason) {
        if (!running) {                                                      // 프로세스가 새로 떠서 측정 상태가 없음 → 끝났다는 표시만
            writeEnd(this, reason); stopSelf(); return;
        }
        savedAcc = append(ACC, ACC_FILE, savedAcc); savedGps = append(GPS, GPS_FILE, savedGps);
        endReason = reason; writeEnd(this, reason);
        NotificationManager nm = alertChannel(); nm.cancel(2);
        if (!"stop".equals(reason)) buzz(new long[]{0, 600});
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        nm.notify(3, new NotificationCompat.Builder(this, "gait_alert")
                .setContentTitle("idleEnd".equals(reason) ? "오래 움직임이 없어 측정을 끝냈어요" : "maxEnd".equals(reason) ? "3시간이 지나 측정을 끝냈어요" : "측정을 끝냈어요")
                .setContentText("앱을 열면 지금까지 잰 기록으로 결과를 저장해요")
                .setSmallIcon(android.R.drawable.ic_menu_directions)
                .setContentIntent(open).setAutoCancel(true).build());
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
    static void writeEnd(Context c, String reason) {
        try { Files.write(new File(c.getFilesDir(), END_FILE).toPath(), reason.getBytes(StandardCharsets.UTF_8)); } catch (IOException e) { /* 다음에 앱이 alive=false로 알아챔 */ }
    }
    static String ended(Context c) {                                         // 끝난 이유 (프로세스가 새로 떴으면 파일에서)
        if (endReason != null) return endReason;
        try { return new String(Files.readAllBytes(new File(c.getFilesDir(), END_FILE).toPath()), StandardCharsets.UTF_8); } catch (IOException e) { return null; }
    }

    @Override
    public void onLocationChanged(Location l) {
        synchronized (GPS) { GPS.add(new double[]{l.getElapsedRealtimeNanos() / 1e6, l.getLatitude(), l.getLongitude(), l.getAccuracy()}); }
    }

    // list[from..]을 파일 끝에 double로 덧붙이고, 다음에 이어 쓸 위치를 돌려줌 (실패하면 다음에 다시)
    private int append(List<double[]> list, String name, int from) {
        List<double[]> rows;
        synchronized (list) { rows = new ArrayList<>(list.subList(Math.min(from, list.size()), list.size())); }
        if (rows.isEmpty()) return from;
        try (DataOutputStream o = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(new File(getFilesDir(), name), true)))) {
            for (double[] r : rows) for (double v : r) o.writeDouble(v);
        } catch (IOException e) { return from; }
        return from + rows.size();
    }

    // 파일의 값을 cols개씩 읽음. 앱이 쓰다가 정리돼 끝이 잘린 줄은 버림
    static List<double[]> read(Context c, String name, int cols) {
        List<double[]> out = new ArrayList<>();
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(new File(c.getFilesDir(), name))))) {
            while (true) { double[] r = new double[cols]; for (int k = 0; k < cols; k++) r[k] = in.readDouble(); out.add(r); }
        } catch (IOException e) { /* 파일 끝 또는 파일 없음 */ }
        return out;
    }

    static void clearFiles(Context c) {
        new File(c.getFilesDir(), ACC_FILE).delete();
        new File(c.getFilesDir(), GPS_FILE).delete();
        new File(c.getFilesDir(), END_FILE).delete(); endReason = null;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (save != null) handler.removeCallbacks(save);
        if (tick != null) handler.removeCallbacks(tick);
        if (endTick != null) handler.removeCallbacks(endTick);
        if (sensors != null) sensors.unregisterListener(this);
        if (location != null) location.removeUpdates(this);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override public void onAccuracyChanged(Sensor s, int a) {}
    @Override public IBinder onBind(Intent i) { return null; }
}
