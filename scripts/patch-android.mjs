import { readFile, writeFile, mkdir } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');

const permissions = [
  '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '    <uses-permission android:name="android.permission.FLASHLIGHT" />',
  '    <uses-permission android:name="android.permission.VIBRATE" />',
  '    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '    <uses-permission android:name="android.permission.CAMERA" />'
];

const missing = permissions.filter(line => !xml.includes(line.trim()));
if (missing.length) {
  xml = xml.replace(/<application\b/, missing.join('\n') + '\n\n    <application');
  await writeFile(manifestPath, xml, 'utf8');
  console.log('Added required Android permissions.');
} else {
  console.log('Required Android permissions already present.');
}

if (!xml.includes('android:name=".EmergencyFallbackActivity"')) {
  xml = xml.replace(
    /<application\b[^>]*>/,
    match => match + '\n        <activity android:name=".EmergencyFallbackActivity" android:exported="false" />'
  );
  await writeFile(manifestPath, xml, 'utf8');
  console.log('Registered native emergency fallback activity.');
}

const gradlePath = 'android/app/build.gradle';
let gradle = await readFile(gradlePath, 'utf8');
const versionCode = Number.parseInt(process.env.OVERBLIKDK_VERSION_CODE || '1', 10);
const versionName = process.env.OVERBLIKDK_VERSION_NAME || '1.0.0';

gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (process.env.OVERBLIKDK_RELEASE_KEYSTORE) {
  if (!gradle.includes('overblikdkRelease')) {
    gradle = gradle.replace(/android\s*\{/, `android {
    signingConfigs {
        overblikdkRelease {
            storeFile file(System.getenv("OVERBLIKDK_RELEASE_KEYSTORE"))
            storePassword System.getenv("OVERBLIKDK_KEYSTORE_PASSWORD")
            keyAlias System.getenv("OVERBLIKDK_KEY_ALIAS")
            keyPassword System.getenv("OVERBLIKDK_KEY_PASSWORD")
        }
    }`);
  }

  gradle = gradle.replace(
    /buildTypes\s*\{\s*release\s*\{/,
    `buildTypes {
        release {
            signingConfig signingConfigs.overblikdkRelease`
  );
}

await writeFile(gradlePath, gradle, 'utf8');
console.log(`Android version set to ${versionName} (code ${versionCode}).`);
if (process.env.OVERBLIKDK_RELEASE_KEYSTORE) console.log('Permanent release signing configured.');


// OverblikDK permanent Android branding.
// Official mark: red four-panel symbol. Generated after Capacitor creates/syncs android/.
const res = 'android/app/src/main/res';
const ensure = async p => mkdir(p, { recursive: true });
await Promise.all([
  ensure(`${res}/drawable`),
  ensure(`${res}/mipmap-anydpi-v26`),
  ensure(`${res}/values`)
]);

const logoVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#F00018" android:pathData="M18,18 H50 V50 H34 C25.2,50 18,42.8 18,34 Z"/>
  <path android:fillColor="#F00018" android:pathData="M58,18 H74 C82.8,18 90,25.2 90,34 V50 H58 Z"/>
  <path android:fillColor="#F00018" android:pathData="M18,58 H50 V90 H34 C25.2,90 18,82.8 18,74 Z"/>
  <path android:fillColor="#F00018" android:pathData="M58,58 H74 C82.8,58 90,65.2 90,74 V90 H58 Z"/>
</vector>
`;
await writeFile(`${res}/drawable/overblikdk_logo.xml`, logoVector, 'utf8');

const launcherForeground = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:insetLeft="28%"
    android:insetTop="28%"
    android:insetRight="28%"
    android:insetBottom="28%"
    android:drawable="@drawable/overblikdk_logo"/>
`;
await writeFile(`${res}/drawable/overblikdk_launcher_foreground.xml`, launcherForeground, 'utf8');

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/overblikdk_icon_background"/>
  <foreground android:drawable="@drawable/overblikdk_launcher_foreground"/>
  <monochrome android:drawable="@drawable/overblikdk_launcher_foreground"/>
</adaptive-icon>
`;
await writeFile(`${res}/mipmap-anydpi-v26/ic_launcher.xml`, adaptiveIcon, 'utf8');
await writeFile(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptiveIcon, 'utf8');

const colorsPath = `${res}/values/overblikdk_colors.xml`;
await writeFile(colorsPath, `<?xml version="1.0" encoding="utf-8"?>
<resources><color name="overblikdk_icon_background">#FFFFFF</color></resources>
`, 'utf8');

const splashDrawable = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@android:color/white"/>
  <item android:width="216dp" android:height="216dp" android:gravity="center" android:drawable="@drawable/overblikdk_logo"/>
</layer-list>
`;
await writeFile(`${res}/drawable/overblikdk_splash.xml`, splashDrawable, 'utf8');

// Capacitor templates can vary. Redirect known splash references to our permanent drawable.
for (const stylePath of [`${res}/values/styles.xml`, `${res}/values-v31/styles.xml`]) {
  try {
    let styles = await readFile(stylePath, 'utf8');
    styles = styles
      .replace(/@drawable\/splash/g, '@drawable/overblikdk_splash')
      .replace(/<item name="android:windowSplashScreenAnimatedIcon">[^<]*<\/item>/g,
               '<item name="android:windowSplashScreenAnimatedIcon">@drawable/overblikdk_logo</item>')
      .replace(/<item name="android:windowSplashScreenBackground">[^<]*<\/item>/g,
               '<item name="android:windowSplashScreenBackground">@android:color/white</item>');
    await writeFile(stylePath, styles, 'utf8');
  } catch {}
}

console.log('OverblikDK red logo applied to Android adaptive icon and splash resources.');

// SOS native fix build trigger v164

// Forside navigation fix build trigger

// Native update-check fix build trigger v165

// Dark category contrast build trigger v166

// Fix Biblioteker/Kultur app-relative navigation

// Hierarchical Android Back navigation build trigger v167

// Final hierarchical Back rollout build trigger v168


// Dedicated native SOS vibration plugin. Avoid WebView/browser haptics ambiguity.
const javaDir = 'android/app/src/main/java/dk/overblikdk/app';
await ensure(javaDir);
await writeFile(`${javaDir}/OverblikVibrationPlugin.java`, `package dk.overblikdk.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OverblikVibration")
public class OverblikVibrationPlugin extends Plugin {
    private Vibrator vibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        long duration = Math.max(1, call.getLong("duration", 180L));
        Vibrator vibrator = vibrator();
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.reject("No vibrator available");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            vibrator.vibrate(duration);
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Vibrator vibrator = vibrator();
        if (vibrator != null) vibrator.cancel();
        call.resolve(new JSObject());
    }
}
`, 'utf8');

await writeFile(`${javaDir}/OfflineEmergencyPlugin.java`, `package dk.overblikdk.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OfflineEmergency")
public class OfflineEmergencyPlugin extends Plugin {
    private static final String PREFS = "overblikdk_offline_emergency";
    private static final String CONTACTS = "contacts";

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Intent intent = new Intent(getContext(), EmergencyFallbackActivity.class);
            getActivity().startActivity(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void syncContacts(PluginCall call) {
        JSArray contacts = call.getArray("contacts");
        if (contacts == null) contacts = new JSArray();
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        prefs.edit().putString(CONTACTS, contacts.toString()).apply();
        JSObject result = new JSObject();
        result.put("count", contacts.length());
        call.resolve(result);
    }

    private boolean hasValidatedInternet() {
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        }
        android.net.NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    @PluginMethod
    public void openIfOffline(PluginCall call) {
        boolean offline = !hasValidatedInternet();
        if (offline) {
            getActivity().runOnUiThread(() -> {
                Intent intent = new Intent(getContext(), EmergencyFallbackActivity.class);
                getActivity().startActivity(intent);
            });
        }
        JSObject result = new JSObject();
        result.put("opened", offline);
        call.resolve(result);
    }
}
`, 'utf8');

await writeFile(`${javaDir}/EmergencyFallbackActivity.java`, `package dk.overblikdk.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

public class EmergencyFallbackActivity extends Activity {
    private static final String PREFS = "overblikdk_offline_emergency";
    private static final String CONTACTS = "contacts";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean sosRunning = false;
    private int sosStep = 0;
    private View sosOverlay;
    private String torchCameraId = null;
    private final int[] signal = {
        180,180, 180,180, 180,540,
        540,180, 540,180, 540,540,
        180,180, 180,180, 180,1260
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildMainUi();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.WHITE);
        view.setPadding(0, dp(8), 0, dp(8));
        if (bold) view.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return view;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(0, dp(6), 0, dp(6));
        button.setLayoutParams(lp);
        button.setMinHeight(dp(54));
        return button;
    }

    private void buildMainUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(20), dp(20), dp(24));
        root.setBackgroundColor(Color.rgb(22, 22, 22));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(22, 22, 22));
        scroll.addView(root);
        setContentView(scroll);

        root.addView(text("🚨 OverblikDK – Nødfallback", 24, true));
        root.addView(text("Denne side ligger i selve appen og virker uden internet.", 16, false));

        Button call112 = button("Ring 112");
        call112.setOnClickListener(v -> confirm112());
        root.addView(call112);

        Button sos = button("Start S.O.S.-blink");
        sos.setOnClickListener(v -> startSOS());
        root.addView(sos);

        root.addView(text("Nødkontakter", 20, true));
        addContacts(root);

        Button retry = button("Prøv OverblikDK online");
        retry.setOnClickListener(v -> {
            if (hasInternet()) {
                finish();
            } else {
                Toast.makeText(this, "Ingen internetforbindelse endnu.", Toast.LENGTH_SHORT).show();
            }
        });
        root.addView(retry);

        root.addView(text("Kort, eksterne links og andre netfunktioner kræver internet.", 14, false));
    }

    private void addContacts(LinearLayout root) {
        SharedPreferences prefs = getSharedPreferences(PREFS, 0);
        String raw = prefs.getString(CONTACTS, "[]");
        try {
            JSONArray contacts = new JSONArray(raw);
            if (contacts.length() == 0) {
                root.addView(text("Ingen nødkontakter er synkroniseret endnu.", 15, false));
                return;
            }
            for (int i = 0; i < contacts.length(); i++) {
                JSONObject c = contacts.optJSONObject(i);
                if (c == null) continue;
                String name = c.optString("name", "Nødkontakt");
                String phone = c.optString("phone", "");
                if (phone.isEmpty()) continue;

                TextView label = text(name + "  ·  " + phone, 16, true);
                root.addView(label);

                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);

                Button dial = button("Ring");
                Button sms = button("SMS");
                LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
                half.setMargins(0, 0, dp(6), dp(8));
                dial.setLayoutParams(half);
                LinearLayout.LayoutParams half2 = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
                half2.setMargins(dp(6), 0, 0, dp(8));
                sms.setLayoutParams(half2);

                dial.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + normalizePhone(phone)))));
                sms.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + normalizePhone(phone)))));
                row.addView(dial);
                row.addView(sms);
                root.addView(row);
            }
        } catch (Exception error) {
            root.addView(text("Nødkontakter kunne ikke læses.", 15, false));
        }
    }

    private String normalizePhone(String phone) {
        return phone.replaceAll("[^0-9+]", "");
    }

    private void confirm112() {
        new AlertDialog.Builder(this)
            .setTitle("Ring 112")
            .setMessage("Vil du åbne telefonens opkaldsskærm med 112?")
            .setNegativeButton("Annuller", null)
            .setPositiveButton("Åbn", (dialog, which) ->
                startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")))
            )
            .show();
    }

    private boolean hasInternet() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        }
        android.net.NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    private void vibrate(long ms) {
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            v.vibrate(ms);
        }
    }

    private boolean ensureTorchReady() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 501);
            return false;
        }
        findTorchCamera();
        return true;
    }

    private void findTorchCamera() {
        try {
            CameraManager camera = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
            if (camera == null) return;
            for (String id : camera.getCameraIdList()) {
                CameraCharacteristics chars = camera.getCameraCharacteristics(id);
                Boolean flash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (Boolean.TRUE.equals(flash) &&
                    (facing == null || facing == CameraCharacteristics.LENS_FACING_BACK)) {
                    torchCameraId = id;
                    return;
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 501) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                findTorchCamera();
                startSOSInternal();
            } else {
                Toast.makeText(this, "Kameratilladelse blev afvist. S.O.S. fortsætter uden lommelygte.", Toast.LENGTH_LONG).show();
                startSOSInternal();
            }
        }
    }

    private void setTorch(boolean on) {
        if (torchCameraId == null) return;
        try {
            CameraManager camera = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
            if (camera != null) camera.setTorchMode(torchCameraId, on);
        } catch (Exception ignored) {}
    }

    private void startSOS() {
        if (sosRunning) return;
        if (!ensureTorchReady()) return;
        startSOSInternal();
    }

    private void startSOSInternal() {
        if (sosRunning) return;
        sosRunning = true;
        sosStep = 0;

        LinearLayout overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER);
        overlay.setBackgroundColor(Color.BLACK);
        overlay.setPadding(dp(24), dp(24), dp(24), dp(24));

        TextView title = text("S.O.S.", 32, true);
        title.setGravity(Gravity.CENTER);
        overlay.addView(title);

        Button stop = button("STOP");
        stop.setOnClickListener(v -> stopSOS());
        overlay.addView(stop);

        addContentView(overlay, new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT
        ));
        sosOverlay = overlay;
        runSOSStep();
    }

    private void runSOSStep() {
        if (!sosRunning || sosOverlay == null) return;
        final boolean on = (sosStep % 2 == 0);
        final int duration = signal[sosStep % signal.length];

        sosOverlay.setBackgroundColor(on ? Color.WHITE : Color.BLACK);
        if (sosOverlay instanceof LinearLayout) {
            LinearLayout layout = (LinearLayout) sosOverlay;
            for (int i = 0; i < layout.getChildCount(); i++) {
                View child = layout.getChildAt(i);
                if (child instanceof TextView && !(child instanceof Button)) {
                    ((TextView) child).setTextColor(on ? Color.BLACK : Color.WHITE);
                }
            }
        }

        setTorch(on);
        if (on) vibrate(duration);

        sosStep = (sosStep + 1) % signal.length;
        handler.postDelayed(this::runSOSStep, duration);
    }

    private void stopSOS() {
        sosRunning = false;
        handler.removeCallbacksAndMessages(null);
        setTorch(false);
        Vibrator v = vibrator();
        if (v != null) v.cancel();
        if (sosOverlay != null) {
            ((android.view.ViewGroup) sosOverlay.getParent()).removeView(sosOverlay);
            sosOverlay = null;
        }
    }

    @Override
    protected void onPause() {
        if (sosRunning) stopSOS();
        super.onPause();
    }
}
`, 'utf8');

const mainActivityPath = `${javaDir}/MainActivity.java`;
await writeFile(mainActivityPath, `package dk.overblikdk.app;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean offlineFallbackShown = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OverblikVibrationPlugin.class);
        registerPlugin(OfflineEmergencyPlugin.class);
        super.onCreate(savedInstanceState);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!offlineFallbackShown && !hasValidatedInternet()) {
                offlineFallbackShown = true;
                startActivity(new Intent(this, EmergencyFallbackActivity.class));
            }
        }, 1200);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Returning from the native fallback must start a fresh online load.
        // Otherwise Chromium can leave its ERR_INTERNET_DISCONNECTED page visible.
        if (offlineFallbackShown && hasValidatedInternet()) {
            offlineFallbackShown = false;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().loadUrl("https://bushidoshq-sys.github.io/OverblikDK/");
                }
            }, 350);
        }
    }

    private boolean hasValidatedInternet() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        }
        android.net.NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }
}
`, 'utf8');

console.log('Dedicated OverblikDK vibration + offline emergency fallback installed.');

// Final native vibrator build trigger v170

// Center front-page emergency button build trigger v171

// Full-screen black/white SOS with centered inverse STOP v172

// Refresh active favorite stars on home v173

// Shared compact Back pill UI v174

// Home favorites active-star logic fix v175

// Home is Android navigation history boundary v176

// Final home-bounded Android navigation rollout v177

// Build trigger: DAWA migration to Adressevaelger + DAGI v2 (2026-10-01)

// Build trigger: fix native vibration MainActivity newlines (2026-10-01)

// Build trigger: manual/automatic location switch v178 (2026-10-01)

// Build trigger: settings polish and manual address reset v179 (2026-10-01)

// Build trigger: final settings, nearby and emergency cleanup (2026-10-01)

// Build trigger: complete Kultur link audit 2026-10-02

// Build trigger: add OverblikDK converter 2026-10-02

// Build trigger: complete library link audit 2026-10-02

// Build trigger: native offline emergency fallback v187 (2026-10-03)

// Final build trigger: bundle offline emergency web bridge 2026-10-03

// Final build trigger: emergency contact sync cache bust 2026-10-03

// Final build trigger: fix native fallback SOS torch permission flow 2026-10-03

// Build trigger: native fallback reconnect + global emergency contact sync 2026-10-03
