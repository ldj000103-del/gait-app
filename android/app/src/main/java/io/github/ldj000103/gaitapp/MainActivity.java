package io.github.ldj000103.gaitapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GaitRecorderPlugin.class);   // 화면 꺼져도 측정하는 네이티브 기능
        registerPlugin(HealthStepsPlugin.class);    // 헬스 커넥트 하루 걸음 수
        super.onCreate(savedInstanceState);
    }
}
