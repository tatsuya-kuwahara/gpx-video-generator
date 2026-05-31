import puppeteer from "puppeteer";
import fs from "fs";

const browser = await puppeteer.launch({
  headless: true,
});

const page = await browser.newPage();

// 動画サイズ
await page.setViewport({
  width: 1280,
  height: 720,
});

// ページを開く
await page.goto("http://localhost:5173", {
  waitUntil: "networkidle2",
});

// MapLibreロード待ち
await page.waitForFunction(() => {
  return window.mapReady === true;
});

// framesフォルダ作成
if (!fs.existsSync("./frames")) {
  fs.mkdirSync("./frames");
}

const totalFrames =
  Number(
    process.env.TOTAL_FRAMES
  );

// フレーム保存
for (let i = 0; i < totalFrames; i++) {
  const filename = `./frames/frame${String(i).padStart(4, "0")}.png`;

  await page.screenshot({
    path: filename,
  });

  console.log(`saved ${filename}`);

  // 次フレーム待機
  await new Promise((resolve) =>
    setTimeout(resolve, 100)
  );
}

await browser.close();