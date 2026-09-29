import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let xml = await readFile(manifestPath, 'utf8');

const permissions = [
  '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />'
];

const missing = permissions.filter(line => !xml.includes(line.trim()));
if (missing.length) {
  xml = xml.replace(/<application\b/, missing.join('\n') + '\n\n    <application');
  await writeFile(manifestPath, xml, 'utf8');
  console.log('Added Android location permissions.');
} else {
  console.log('Android location permissions already present.');
}
