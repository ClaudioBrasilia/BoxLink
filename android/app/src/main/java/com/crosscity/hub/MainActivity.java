package com.crosscity.hub;

import android.os.Bundle;

import com.crosscity.ble.BleForegroundPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BleForegroundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
