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
        clearFiles(this); savedAcc = savedGps = 0; running = true;
        save = () -> { savedAcc = append(ACC, ACC_FILE, savedAcc); savedGps = append(GPS, GPS_FILE, savedGps); handler.postDelayed(save, 10000); };
        handler.postDelayed(save, 10000);
        // 최대 3시간이면 자동 해제 (앱도 3시간 넘은 측정은 버림)
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gait:rec");
        wakeLock.acquire(3 * 3600 * 1000L);
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
