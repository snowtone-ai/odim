import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

const read = (path) => readFileSync(path, "utf8");

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function readRgbaPng(path) {
  const png = readFileSync(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  let offset = 8;
  let width = 0;
  let height = 0;
  const compressed = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "brand PNG must use 8-bit channels");
      assert.equal(data[9], 6, "brand PNG must be RGBA");
      assert.equal(data[12], 0, "brand PNG must not be interlaced");
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const encoded = inflateSync(Buffer.concat(compressed));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgba = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceOffset + x];
      const outputOffset = y * stride + x;
      const left = x >= bytesPerPixel ? rgba[outputOffset - bytesPerPixel] : 0;
      const up = y > 0 ? rgba[outputOffset - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? rgba[outputOffset - stride - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : assert.fail("Unsupported PNG filter " + filter);
      rgba[outputOffset] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }
  return { png, width, height, rgba };
}

function analyzeVisiblePixels(image) {
  const allowed = new Set(["76,144,240", "92,198,210"]);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] === 0) continue;
    const pixel = index / 4;
    const x = pixel % image.width;
    const y = Math.floor(pixel / image.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    assert.ok(
      allowed.has([image.rgba[index], image.rgba[index + 1], image.rgba[index + 2]].join(",")),
      "visible antialiasing must vary alpha only and keep the approved brand RGB values"
    );
  }
  assert.ok(maxX >= minX && maxY >= minY, "brand mark must contain visible pixels");
  return { widthRatio: (maxX - minX + 1) / image.width, heightRatio: (maxY - minY + 1) / image.height };
}

test("brand components use the square generated marks without duplicate narration", () => {
  const odim = read("components/ui/odim-logo.tsx");
  const huginn = read("components/ui/huginn-icon.tsx");

  assert.match(odim, /src="\/brand\/odim-mark\.png"/);
  assert.match(odim, /alt=""/);
  assert.match(odim, /width=\{size\}/);
  assert.match(odim, /height=\{size\}/);
  assert.match(odim, /priority = false/);
  assert.match(odim, /priority=\{priority\}/);
  assert.match(odim, /aspectRatio: "1 \/ 1"/);
  assert.match(huginn, /src="\/brand\/huginn-mark\.png"/);
  assert.match(huginn, /alt=""/);
  assert.match(huginn, /width=\{size\}/);
  assert.match(huginn, /height=\{size\}/);
  assert.match(huginn, /aspectRatio: "1 \/ 1"/);
  assert.doesNotMatch(`${odim}\n${huginn}`, /\/odim-logo\.png|\/huginn-icon\.png/);
});

test("metadata and push notifications point at the new Odim mark", () => {
  const layout = read("app/layout.tsx");
  const serviceWorker = read("public/push-sw.js");

  assert.equal((layout.match(/\/brand\/odim-mark\.png/g) ?? []).length, 5);
  assert.match(serviceWorker, /icon:\s*"\/brand\/odim-mark\.png"/);
  assert.doesNotMatch(`${layout}\n${serviceWorker}`, /\/odim-logo\.png/);
});

test("generated marks are present as square PNG assets", () => {
  for (const path of ["public/brand/odim-mark.png", "public/brand/huginn-mark.png"]) {
    const png = readFileSync(path);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(png.length > 25);
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20));
    assert.ok([4, 6].includes(png[25]), "mark PNG must preserve an alpha channel");
  }
});

test("generated marks are compact, tightly cropped, and limited to the approved palette", () => {
  const odim = readRgbaPng("public/brand/odim-mark.png");
  const huginn = readRgbaPng("public/brand/huginn-mark.png");
  for (const image of [odim, huginn]) {
    assert.equal(image.width, 512);
    assert.equal(image.height, 512);
    assert.ok(image.png.length < 100_000, "brand PNG must remain below 100 KB");
  }

  const odimBounds = analyzeVisiblePixels(odim);
  const huginnBounds = analyzeVisiblePixels(huginn);
  assert.ok(odimBounds.widthRatio >= 0.9 && odimBounds.heightRatio >= 0.9, "Odim mark must occupy at least 90% of both axes");
  assert.ok(huginnBounds.widthRatio >= 0.85, "Huginn mark must occupy at least 85% of its width");
  assert.ok(huginnBounds.heightRatio >= 0.75, "Huginn mark must occupy at least 75% of its height");
});
