// Keep returning visitors from combining fresh HTML with cached older assets.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const studio = path.resolve(__dirname, "../studio");
for(const [page,files] of Object.entries({"index.html":["style.css", "template.js", "experience.js", "runtime-schema.js","runtime.js","serial.js","app.js","scene-model.js","scenes.js","looks.js","controller-state.js","controller.js","audio.js","audio-ui.js","audio-prep.js","audio-prep-ui.js","release.js"],"usb.html":["style.css","serial.js","usb.js"],"install.html":["style.css","release.js","installer.js"]})) {
const target = path.join(studio, page);
const original = fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
let expected = original;
for (const file of files) {
  const source = fs.readFileSync(path.join(studio, file), "utf8").replace(/\r\n/g, "\n");
  const revision = crypto.createHash("sha256").update(source).digest("hex").slice(0, 12);
  const attribute = file.endsWith(".css") ? "href" : "src";
  const pattern = new RegExp(attribute + '="\\./' + file.replace(".", "\\.") + '(?:\\?v=[a-f0-9]+)?"', "g");
  if ((expected.match(pattern) || []).length !== 1) {
    throw new Error("Expected one local Studio reference to " + file);
  }
  expected = expected.replace(pattern, attribute + '="./' + file + '?v=' + revision + '"');
}
if (process.argv.includes("--check")) {
  if (original !== expected) {
    console.error("Studio asset versions are stale. Run: node scripts/version-studio-assets.cjs");
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(target, expected);
}
}
