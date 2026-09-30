import { readFile, writeFile, mkdir } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');

const permissions = [
  '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '    <uses-permission android:name="android.permission.FLASHLIGHT" />'
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
    android:insetLeft="12%"
    android:insetTop="12%"
    android:insetRight="12%"
    android:insetBottom="12%"
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
