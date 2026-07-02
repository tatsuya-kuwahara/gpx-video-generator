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

const totalFrames =
  Number(
    process.env.TOTAL_FRAMES
);
console.log(totalFrames);

const realtime = Boolean(process.env.IS_REALTIME);

if(realtime) console.log(realtime);
// ページを開く
await page.goto("http://localhost:5173?capture=true&&realtime=${realtime}&&frames=${totalFrames}", {
  waitUntil: "networkidle2",
});

// MapLibreロード待ち
await page.waitForFunction(() => {
  return window.mapReady && window.mapIdle && typeof window.renderFrame === "function";
});

// framesフォルダ作成
if (!fs.existsSync("./frames")) {
  fs.mkdirSync("./frames");
}

/*
await page.goto(
  `http://localhost:5173/?frames=${totalFrames}`
);
*/
console.log("フレーム保存を開始");
// スタート地点の地図をあらかじめ呼んでおき一定時間待つことで初めのフレームが真っ白になるのを防ぐ
await page.evaluate(
    (totalFrames) => {
      window.renderFrame(0, totalFrames);
    },
    totalFrames
  );
/*
// 地図タイルが揃うのを待つ（効果なし）
await page.waitForFunction(
  () =>
    window.map &&
    window.map.areTilesLoaded() &&
    window.mapIdle
);
*/
await page.evaluate(
  () =>
    new Promise(resolve =>
      setTimeout(resolve, 3000)
    )
);
// フレーム保存
for (let frame = 0; frame < totalFrames; frame++) {
  await page.evaluate(
    (frame, totalFrames) => {
      window.renderFrame(frame, totalFrames);
    },
    frame,
    totalFrames
  );

  await page.evaluate(() =>
    new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    )
  );

  await page.screenshot({
    path: `frames/${String(frame).padStart(6, "0")}.png`
  });
}

await browser.close();