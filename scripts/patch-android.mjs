import { readFile, writeFile } from 'node:fs/promises';

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
