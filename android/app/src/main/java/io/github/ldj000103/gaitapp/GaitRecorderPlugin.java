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

// JS에서 Capacitor.Plugins.GaitRecorder.start({gps, intervalSec, endSec}) / stop() → {samples:[{t,x,y,z}], gps:[{t,lat,lon,acc}]}
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
        JSObject ret = new JSObject();
        ret.put("samples", toArray(GaitService.ACC, new String[]{"t", "x", "y", "z"}));
        ret.put("gps", toArray(GaitService.GPS, new String[]{"t", "lat", "lon", "acc"}));
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
