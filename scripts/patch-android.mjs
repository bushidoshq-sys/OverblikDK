import { readFile, writeFile, mkdir } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');

const permissions = [
  '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '    <uses-permission android:name="android.permission.FLASHLIGHT" />',
  '    <uses-permission android:name="android.permission.VIBRATE" />'
];

const missing = permissions.filter(line => !xml.includes(line.trim()));
if (missing.length) {
  xml = xml.replace(/<application\b/, missing.join('\n') + '\n\n    <application');
  await writeFile(manifestPath, xml, 'utf8');
  console.log('Added required Android permissions.');
} else {
  console.log('Required Android permissions already present.');
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

const mainActivityPath = `${javaDir}/MainActivity.java`;
let mainActivity = await readFile(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(OverblikVibrationPlugin.class)')) {
  mainActivity = mainActivity.replace(
    /public class MainActivity extends BridgeActivity \{/,
    'public class MainActivity extends BridgeActivity {\\n  @Override\\n  public void onCreate(android.os.Bundle savedInstanceState) {\\n    registerPlugin(OverblikVibrationPlugin.class);\\n    super.onCreate(savedInstanceState);\\n  }'
  );
  await writeFile(mainActivityPath, mainActivity, 'utf8');
}
console.log('Dedicated OverblikDK native vibration plugin installed.');

// Final native vibrator build trigger v170

// Center front-page emergency button build trigger v171

// Full-screen black/white SOS with centered inverse STOP v172

// Refresh active favorite stars on home v173

// Shared compact Back pill UI v174

// Home favorites active-star logic fix v175

// Home is Android navigation history boundary v176
