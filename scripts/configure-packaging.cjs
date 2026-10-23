
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");

const pkg = JSON.parse(
  fs.readFileSync(packagePath, "utf8")
);

pkg.name = "luna-cycle-tracker";
pkg.productName = "Luna";
pkg.description =
  "A private, offline-first menstrual cycle tracker.";

pkg.version = pkg.version || "1.0.0";
pkg.main = "electron/main.cjs";

pkg.scripts = {
  ...pkg.scripts,

  "icons": "node scripts/generate-icon.cjs",

  "build:renderer": "vite build",

  "postinstall": "electron-builder install-app-deps",

  "dist:win":
    "npm run icons && npm run build:renderer && electron-builder --win nsis --x64",

  "pack:win":
    "npm run icons && npm run build:renderer && electron-builder --win dir --x64"
};

pkg.build = {
  appId: "com.luna.cycletracker",
  productName: "Luna",

  directories: {
    output: "release",
    buildResources: "assets"
  },

  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],

  asar: true,

  asarUnpack: [
    "**/node_modules/better-sqlite3/**"
  ],

  npmRebuild: true,

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],

    icon: "assets/luna-icon.ico",

    artifactName:
      "Luna-Setup-${version}-${arch}.${ext}"
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Luna",
    uninstallDisplayName: "Luna",
    deleteAppDataOnUninstall: false
  }
};

fs.writeFileSync(
  packagePath,
  JSON.stringify(pkg, null, 2) + "\n",
  "utf8"
);

console.log("Luna packaging configuration saved.");
console.log("Existing dependencies and dev script preserved.");

