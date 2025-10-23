// android/app/src/main/java/com/mouseshareapp/MouseShareAccessibilityService.java
package com.example.mouseshareapp;  // ← FIXED PACKAGE NAME

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;

public class MouseShareAccessibilityService extends AccessibilityService {
    
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // We don't need to handle events, only dispatch gestures
    }

    @Override
    public void onInterrupt() {
        // Handle interruption
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        // Register this service with the module
        TouchInjectionModule.setAccessibilityService(this);
    }

    @Override
    public boolean onUnbind(Intent intent) {
        TouchInjectionModule.setAccessibilityService(null);
        return super.onUnbind(intent);
    }
}