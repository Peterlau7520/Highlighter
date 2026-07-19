// Copies the extension's static (non-TypeScript) assets into dist/ after
// tsc runs. Plain Node/fs instead of shell commands (mkdir -p, cp) so this
// works the same on Windows as on Mac/Linux — npm runs scripts via cmd.exe
// on Windows, which doesn't understand either.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

fs.mkdirSync(path.join(dist, "popups"), { recursive: true });
fs.copyFileSync(
  path.join(root, "manifest.json"),
  path.join(dist, "manifest.json"),
);
fs.cpSync(path.join(root, "icons"), path.join(dist, "icons"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(root, "popups", "popup.html"),
  path.join(dist, "popups", "popup.html"),
);
