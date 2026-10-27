package io.github.ldj000103.gaitapp;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GaitRecorderPlugin.class);   // 화면 꺼져도 측정하는 네이티브 기능
        registerPlugin(HealthStepsPlugin.class);    // 헬스 커넥트 하루 걸음 수
        super.onCreate(savedInstanceState);
        // 휴대폰 뒤로 가기: 화면(app.js window.gaitBack)에 먼저 물어 열린 판을 닫고, 닫을 게 없으면 예전처럼 앱을 닫음
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript("window.gaitBack ? window.gaitBack() === true : false", v -> {
                    if ("true".equals(v)) return;
                    setEnabled(false);                                    // 이 콜백을 빼고 기본 동작(앱 닫기)으로
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                });
            }
        });
    }
}
