const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(root, "studio/index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "studio/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "studio/style.css"), "utf8");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("homepage redirects to the Skelly Studio folder", () => {
  assert.match(home, /url=\.\/studio\//);
  assert.match(home, /<a href="\.\/studio\/">Open Skelly Studio<\/a>/);
});

test("gallery offers 18 real eye icons with enlarged previews and source credit", () => {
  assert.match(html, /id="eyePreviewImage"/);
  assert.match(html, /id="eyePreviewLabel"/);
  assert.match(html, /id="eyeGrid"/);
  assert.match(html, /id="selectedEyeCount"/);
  assert.match(js, /for\(let i=1;i<=18;i\+\+\)/);
  assert.match(js, /https:\/\/raw\.githubusercontent\.com\/martinecker\/SkellyUltraWebController\/main\/images\/skelly\/eye_icon_/);
  assert.match(js, /image\.src=eyeImageUrl\(i\)/);
  assert.match(js, /zoom\.addEventListener\("click",\(\)=>showEyePreview\(i\)\)/);
  assert.match(css, /\.eye-grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(html, /not copied into this repository/);
});
