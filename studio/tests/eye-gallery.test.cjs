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
  assert.match(js, /for\(let i=1;i<=20;i\+\+\)/);
  assert.match(js, /card.hidden=i>18/);
  assert.match(js, /\.\/images\/eyes\/eye_icon_/);
  for(let i=1;i<=18;i++) {
    const bytes=fs.readFileSync(path.join(root,'studio/images/eyes',`eye_icon_${i}.png`));
    // Upstream includes both PNG and BMP data under .png filenames.
    assert.ok(bytes.subarray(0,2).toString()==='BM'||bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a');
    assert.ok(bytes.length>1000);
  }
  assert.match(js, /image\.src=eyeImageUrl\(i\)/);
  assert.match(js, /zoom\.addEventListener\("click",\(\)=>showEyePreview\(i\)\)/);
  assert.match(css, /\.eye-grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(html, /included for offline use/);
  assert.doesNotMatch(html, /View eye designs/);
});
