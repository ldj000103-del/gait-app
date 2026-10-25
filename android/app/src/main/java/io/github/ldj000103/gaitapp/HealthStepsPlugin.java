package io.github.ldj000103.gaitapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.aggregate.AggregateMetric;
import androidx.health.connect.client.aggregate.AggregationResultGroupedByPeriod;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest;
import androidx.health.connect.client.time.TimeRangeFilter;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.jvm.functions.Function2;
import kotlinx.coroutines.BuildersKt;

// 헬스 커넥트(안드로이드 공식 건강 데이터 창구)에서 날짜별 걸음 수 읽기
// 삼성헬스 등이 넣어 둔 걸음 수를 사용자가 허락한 경우에만 읽고, 휴대폰 밖으로 보내지 않음
// JS: Capacitor.Plugins.HealthSteps.status() / request() / daily({from, to}) → {days:[{date, steps}]}
@CapacitorPlugin(name = "HealthSteps")
public class HealthStepsPlugin extends Plugin {
    static final String READ_STEPS = "android.permission.health.READ_STEPS";
    static final String HC_PKG = "com.google.android.apps.healthdata";
    private final ActivityResultContract<Set<String>, Set<String>> contract = PermissionController.Companion.createRequestPermissionResultContract(HC_PKG);

    // ponytail: 헬스 커넥트는 코틀린 suspend 함수뿐이라 자바에서 runBlocking으로 기다림 (플러그인 메서드는 백그라운드 스레드라 화면은 안 멈춤)
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> T await(Function2 block) throws InterruptedException {
        return (T) BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, block);
    }

    @PluginMethod
    public void status(PluginCall call) {
        int s = HealthConnectClient.Companion.getSdkStatus(getContext(), HC_PKG);
        JSObject ret = new JSObject();
        ret.put("available", s == HealthConnectClient.SDK_AVAILABLE);
        ret.put("needsUpdate", s == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED);
        ret.put("granted", false);
        if (s == HealthConnectClient.SDK_AVAILABLE) {
            try {
                HealthConnectClient c = HealthConnectClient.Companion.getOrCreate(getContext(), HC_PKG);
                Set<String> g = await((Function2) (scope, k) -> c.getPermissionController().getGrantedPermissions((kotlin.coroutines.Continuation) k));
                ret.put("granted", g.contains(READ_STEPS));
            } catch (Exception e) { call.reject(e.toString()); return; }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void request(PluginCall call) {
        startActivityForResult(call, contract.createIntent(getContext(), Collections.singleton(READ_STEPS)), "onRequest");
    }

    @ActivityCallback
    private void onRequest(PluginCall call, ActivityResult result) {
        Set<String> g = contract.parseResult(result.getResultCode(), result.getData());
        JSObject ret = new JSObject();
        ret.put("granted", g.contains(READ_STEPS));
        call.resolve(ret);
    }

    @PluginMethod
    public void daily(PluginCall call) {   // from·to: 'YYYY-MM-DD' (to 포함), 휴대폰 시간대 기준 하루씩
        try {
            LocalDateTime a = LocalDate.parse(call.getString("from")).atStartOfDay(), b = LocalDate.parse(call.getString("to")).plusDays(1).atStartOfDay();
            HealthConnectClient c = HealthConnectClient.Companion.getOrCreate(getContext(), HC_PKG);
            Set<AggregateMetric<?>> metrics = new HashSet<>();
            metrics.add(StepsRecord.COUNT_TOTAL);
            AggregateGroupByPeriodRequest req = new AggregateGroupByPeriodRequest(metrics, TimeRangeFilter.Companion.between(a, b), Period.ofDays(1), Collections.emptySet());
            List<AggregationResultGroupedByPeriod> rows = await((Function2) (scope, k) -> c.aggregateGroupByPeriod(req, (kotlin.coroutines.Continuation) k));
            JSArray out = new JSArray();
            for (AggregationResultGroupedByPeriod r : rows) {
                Long n = r.getResult().get(StepsRecord.COUNT_TOTAL);
                JSObject o = new JSObject();
                o.put("date", r.getStartTime().toLocalDate().toString());
                o.put("steps", n == null ? 0 : n);
                out.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("days", out);
            call.resolve(ret);
        } catch (Exception e) { call.reject(e.toString()); }
    }

    // 헬스 커넥트 권한 화면의 "개인정보 처리방침" → 처리방침 웹페이지를 열고 바로 닫힘
    public static class Rationale extends Activity {
        @Override
        protected void onCreate(Bundle b) {
            super.onCreate(b);
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://ldj000103-del.github.io/gait-app/privacy.html")));
            finish();
        }
    }
}
