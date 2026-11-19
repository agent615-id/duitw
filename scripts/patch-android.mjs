import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const androidRoot = path.resolve("android/app/src/main");
const resRoot = path.join(androidRoot, "res");
const sourceRoot = path.resolve("assets/android-res");

for (const folder of [
  "mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi",
  "mipmap-xxxhdpi", "mipmap-anydpi-v26", "drawable"
]) {
  await mkdir(path.join(resRoot, folder), { recursive: true });
  await cp(path.join(sourceRoot, folder), path.join(resRoot, folder), { recursive: true, force: true });
}

const valuesPath = path.join(resRoot, "values");
await mkdir(valuesPath, { recursive: true });
const colorsPath = path.join(valuesPath, "colors.xml");
let colors = "";
try { colors = await readFile(colorsPath, "utf8"); } catch {}
if (!colors.includes('name="launcher_background"')) {
  if (colors.includes("</resources>")) colors = colors.replace("</resources>", '  <color name="launcher_background">#070b12</color>\n</resources>');
  else colors = '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="launcher_background">#070b12</color></resources>';
  await writeFile(colorsPath, colors);
}

const stylesPath = path.join(valuesPath, "styles.xml");
let styles = await readFile(stylesPath, "utf8");
const items = [
  '<item name="android:statusBarColor">#070b12</item>',
  '<item name="android:navigationBarColor">#070b12</item>',
  '<item name="android:navigationBarDividerColor">#070b12</item>',
  '<item name="android:windowLightStatusBar">false</item>',
  '<item name="android:windowLightNavigationBar">false</item>',
  '<item name="android:windowActionModeOverlay">true</item>'
].join("\n        ");
if (!styles.includes('name="android:navigationBarColor"')) {
  const target = /(<style[^>]*name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?)(<\/style>)/;
  if (target.test(styles)) styles = styles.replace(target, `$1        ${items}\n    $2`);
  else styles = styles.replace("</resources>", `  <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">\n        ${items}\n  </style>\n</resources>`);
  await writeFile(stylesPath, styles);
}

if (!styles.includes('name="android:windowSplashScreenAnimatedIcon"')) {
  const launchItems = [
    '<item name="android:windowSplashScreenBackground">#070b12</item>',
    '<item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>',
    '<item name="android:windowSplashScreenIconBackgroundColor">#070b12</item>'
  ].join("\n        ");
  const launchTheme = /(<style[^>]*name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?)(<\/style>)/;
  if (launchTheme.test(styles)) styles = styles.replace(launchTheme, `$1        ${launchItems}\n    $2`);
  await writeFile(stylesPath, styles);
}

const manifestPath = path.join(androidRoot, "AndroidManifest.xml");
let manifest = await readFile(manifestPath, "utf8");
manifest = manifest.replace(/android:windowSoftInputMode="[^"]*"/, 'android:windowSoftInputMode="adjustResize"');
if (!manifest.includes('android:windowSoftInputMode=')) {
  manifest = manifest.replace(/(<activity\b[^>]*)(>)/, '$1 android:windowSoftInputMode="adjustResize"$2');
}
await writeFile(manifestPath, manifest);
console.log("Android icon, system bars, and keyboard configuration applied.");
