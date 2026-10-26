package io.github.ldj000103.gaitapp;

import android.Manifest;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import java.util.List;

// JS에서 Capacitor.Plugins.GaitRecorder.start({gps, intervalSec, endSec}) / stop() → {samples:[{t,x,y,z}], gps:[{t,lat,lon,acc}], fromFile} / peek({sec}) → {samples, gps, alive}
// 권한은 기본 제공 requestPermissions({permissions:['location','notifications']})로 요청
@CapacitorPlugin(name = "GaitRecorder", permissions = {
        @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
        @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
})
public class GaitRecorderPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), GaitService.class)
                .putExtra("gps", call.getBoolean("gps", false))
                .putExtra("intervalSec", call.getInt("intervalSec", 0))
                .putExtra("endSec", call.getInt("endSec", 0));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), GaitService.class));
        boolean fromFile;
        synchronized (GaitService.ACC) { fromFile = GaitService.ACC.isEmpty(); }   // 비었으면 휴대폰이 앱을 정리했던 것 → 파일에 남은 값
        List<double[]> acc = fromFile ? GaitService.read(getContext(), GaitService.ACC_FILE, 4) : GaitService.ACC;
        List<double[]> gps = fromFile ? GaitService.read(getContext(), GaitService.GPS_FILE, 4) : GaitService.GPS;
        JSObject ret = new JSObject();
        ret.put("samples", toArray(acc, new String[]{"t", "x", "y", "z"}));
        ret.put("gps", toArray(gps, new String[]{"t", "lat", "lon", "acc"}));
        ret.put("fromFile", fromFile);
        GaitService.clearFiles(getContext());
        call.resolve(ret);
    }

    // 측정을 멈추지 않고 최근 sec초 가속도 + 지금까지 GPS (측정 중 화면에 실시간 값 표시용)
    @PluginMethod
    public void peek(PluginCall call) {
        double sec = call.getInt("sec", 20);
        List<double[]> tail = new java.util.ArrayList<>();
        synchronized (GaitService.ACC) {
            int n = GaitService.ACC.size();
            if (n > 0) {
                double cut = GaitService.ACC.get(n - 1)[0] - sec * 1000;
                for (int i = n - 1; i >= 0 && GaitService.ACC.get(i)[0] >= cut; i--) tail.add(0, GaitService.ACC.get(i));
            }
        }
        JSObject ret = new JSObject();
        ret.put("samples", toArray(tail, new String[]{"t", "x", "y", "z"}));
        ret.put("gps", toArray(GaitService.GPS, new String[]{"t", "lat", "lon", "acc"}));
        ret.put("alive", GaitService.running);                 // false면 측정 중에 휴대폰이 앱을 정리한 것
        call.resolve(ret);
    }

    private static JSArray toArray(List<double[]> rows, String[] keys) {
        JSArray out = new JSArray();
        synchronized (rows) {
            for (double[] r : rows) {
                JSObject o = new JSObject();
                for (int k = 0; k < keys.length; k++) o.put(keys[k], r[k]);
                out.put(o);
            }
        }
        return out;
    }
}
