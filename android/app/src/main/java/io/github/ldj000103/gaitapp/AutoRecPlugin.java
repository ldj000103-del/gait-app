package io.github.ldj000103.gaitapp;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.Arrays;
import java.util.List;

// 걷기 자동 측정 (AutoService). JS: Capacitor.Plugins.AutoRec.enable() / disable() / status() → {on, running, supported}
// list() → {items:[{id, wall}]} (오래된 순) / take({id}) → {samples:[{t,x,y,z}]} (읽고 파일 지움) / clear() (안 가져온 자동 기록 파일 모두 지움)
@CapacitorPlugin(name = "AutoRec")
public class AutoRecPlugin extends Plugin {
    @PluginMethod
    public void enable(PluginCall call) {
        if (!AutoService.supported(getContext())) { call.reject("unsupported"); return; }
        AutoService.setOn(getContext(), true);
        ContextCompat.startForegroundService(getContext(), new Intent(getContext(), AutoService.class));
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        AutoService.setOn(getContext(), false);
        getContext().stopService(new Intent(getContext(), AutoService.class));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("on", AutoService.isOn(getContext()));
        r.put("running", AutoService.running);
        r.put("supported", AutoService.supported(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void list(PluginCall call) {
        File[] fs = AutoService.dir(getContext()).listFiles();
        JSArray items = new JSArray();
        if (fs != null) {
            Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
            for (File f : fs) {
                String id = f.getName();
                if (!id.endsWith(".bin")) continue;
                JSObject o = new JSObject();
                o.put("id", id);
                try { o.put("wall", Long.parseLong(id.substring(0, id.length() - 4))); } catch (NumberFormatException e) { continue; }
                items.put(o);
            }
        }
        JSObject r = new JSObject(); r.put("items", items); call.resolve(r);
    }

    @PluginMethod
    public void take(PluginCall call) {
        String id = call.getString("id", "");
        if (!id.matches("\\d+\\.bin")) { call.reject("bad id"); return; }
        List<double[]> rows = GaitService.read(getContext(), AutoService.DIR + "/" + id, 4);
        JSArray out = new JSArray();
        for (double[] p : rows) {
            JSObject o = new JSObject();
            o.put("t", p[0]); o.put("x", p[1]); o.put("y", p[2]); o.put("z", p[3]);
            out.put(o);
        }
        new File(AutoService.dir(getContext()), id).delete();
        JSObject r = new JSObject(); r.put("samples", out); call.resolve(r);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        File[] fs = AutoService.dir(getContext()).listFiles();
        if (fs != null) for (File f : fs) f.delete();
        call.resolve();
    }
}
