import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

const native = Capacitor.isNativePlatform();
if (native) document.documentElement.classList.add("capacitor-native");
let backHandler = null;

window.duitwNative = {
  isNative: () => native,
  async exportFile(filename, content, mimeType) {
    if (!native) throw new Error("Native file export is unavailable");
    const saved = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true
    });
    await Share.share({
      title: filename,
      text: `File ${filename} dari duitw`,
      url: saved.uri,
      dialogTitle: "Simpan atau bagikan file"
    });
  },
  onBackButton(callback) {
    backHandler = callback;
  },
  exitApp() {
    if (native) App.exitApp();
  }
};

if (native) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#070b12" }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  App.addListener("backButton", () => {
    if (typeof backHandler === "function") backHandler();
    else App.exitApp();
  });
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) SplashScreen.hide().catch(() => {});
  });
}
