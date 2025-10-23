// android/app/src/main/java/com/mouseshareapp/TouchInjectionModule.java
package com.example.mouseshareapp;  // ← FIXED PACKAGE NAME

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.os.Build;
import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class TouchInjectionModule extends ReactContextBaseJavaModule {
    private static TouchInjectionModule instance;
    private static AccessibilityService accessibilityService;
    
    public TouchInjectionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        instance = this;
    }

    @Override
    public String getName() {
        return "TouchInjection";
    }

    public static void setAccessibilityService(AccessibilityService service) {
        accessibilityService = service;
    }

    @ReactMethod
    public void checkAccessibilityEnabled(Promise promise) {
        if (accessibilityService != null) {
            promise.resolve(true);
        } else {
            promise.resolve(false);
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.N)
    @ReactMethod
    public void injectTouch(float x, float y, String action, Promise promise) {
        if (accessibilityService == null) {
            promise.reject("NO_SERVICE", "Accessibility service not enabled");
            return;
        }

        try {
            Path path = new Path();
            path.moveTo(x, y);

            long duration = action.equals("down") ? 100 : 1;
            
            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            GestureDescription.StrokeDescription stroke = 
                new GestureDescription.StrokeDescription(path, 0, duration);
            gestureBuilder.addStroke(stroke);
            
            boolean dispatched = accessibilityService.dispatchGesture(
                gestureBuilder.build(),
                new AccessibilityService.GestureResultCallback() {
                    @Override
                    public void onCompleted(GestureDescription gestureDescription) {
                        super.onCompleted(gestureDescription);
                    }

                    @Override
                    public void onCancelled(GestureDescription gestureDescription) {
                        super.onCancelled(gestureDescription);
                    }
                },
                null
            );

            if (dispatched) {
                promise.resolve(true);
            } else {
                promise.reject("DISPATCH_FAILED", "Failed to dispatch gesture");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.N)
    @ReactMethod
    public void injectClick(float x, float y, Promise promise) {
        if (accessibilityService == null) {
            promise.reject("NO_SERVICE", "Accessibility service not enabled");
            return;
        }

        try {
            Path path = new Path();
            path.moveTo(x, y);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            GestureDescription.StrokeDescription stroke = 
                new GestureDescription.StrokeDescription(path, 0, 100);
            gestureBuilder.addStroke(stroke);
            
            accessibilityService.dispatchGesture(
                gestureBuilder.build(),
                null,
                null
            );

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.N)
    @ReactMethod
    public void injectScroll(float startX, float startY, float endX, float endY, Promise promise) {
        if (accessibilityService == null) {
            promise.reject("NO_SERVICE", "Accessibility service not enabled");
            return;
        }

        try {
            Path path = new Path();
            path.moveTo(startX, startY);
            path.lineTo(endX, endY);

            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            GestureDescription.StrokeDescription stroke = 
                new GestureDescription.StrokeDescription(path, 0, 300);
            gestureBuilder.addStroke(stroke);
            
            accessibilityService.dispatchGesture(
                gestureBuilder.build(),
                null,
                null
            );

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
