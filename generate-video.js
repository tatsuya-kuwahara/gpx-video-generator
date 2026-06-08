import fs from "fs";
import { execSync } from "child_process";
import { spawn } from "child_process";
import { DOMParser } from "xmldom";
import { gpx } from "@tmcw/togeojson";
import { parseArgs } from 'node:util';

const options = {
    inputGPX: {type: 'string', short: 'g'},
    outputMP4: {type: 'string', short: 'm', default: 'videos/output.mp4'},
    fps: {type: 'string', short: 'f', default: '30'},
    duration: {type: 'string', short: 'd'},
    preview: {type: 'boolean', short: 'p'}
}

// 引数のチェックと解析
let values;
try {
  const { values: parsedValues } = parseArgs({ options });
  values = parsedValues;

  console.log(values); 

  if (!values.inputGPX) {
    throw new Error('エラー: --inputGPX (-g) オプションは必須です。');
  }
  if (!values.outputMP4) {
    throw new Error('エラー: --outputMP4 (-m) オプションは必須です。');
  }

} catch (error) {
  console.error(error.message);
  process.exit(1); // エラー終了
}

if (!values.inputGPX) {
  console.error(
    "usage: node generate-video.js route.gpx output.mp4"
  );
  process.exit(1);
}

// GPXコピー
fs.copyFileSync(
  values.inputGPX,
  "./public/route.gpx"
);

// 古いフレーム削除
if (fs.existsSync("./frames")) {
  fs.rmSync("./frames", {
    recursive: true,
    force: true,
  });
}

fs.mkdirSync("./frames", {
  recursive: true,
});

let totalDistance = 0;

// 座標同士の距離を計算する関数（戻り値の単位: メートル）
function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

const gpxText =
  fs.readFileSync(
    values.inputGPX,
    "utf-8"
  );

/*
const coordinates =
  geojson.features[0]
  .geometry.coordinates;

// 総距離を計算
let totalDistance = 0;
for (
  let i = 1;
  i < coordinates.length;
  i++
) {
  const prev = coordinates[i - 1];

  const curr = coordinates[i];

  totalDistance +=
    calculateDistance(
      prev[1],
      prev[0],
      curr[1],
      curr[0]
    );
}
console.log(
  `distance: ${totalDistance.toFixed(2)} km`
);
*/
const xml =
  new DOMParser()
  .parseFromString(
    gpxText,
    "text/xml"
  );

const routeData = parseGPX(xml);
const geoJSON = createGeoJSON(routeData);
// 作成したJSONファイルを保存する
fs.writeFileSync(
  "./public/routeData.json",
  JSON.stringify(routeData)
);
fs.writeFileSync(
  "./public/route.geojson",
  JSON.stringify(geoJSON)
);


/**
 * 緯度経度、標高、時間、スタートからの距離を含むデータを返す。
 * @param {xml} xmlDoc 
 * @returns routeData
 */
function parseGPX(xmlDoc) {
  const routeData = [];

  const trkpts =
    xmlDoc.getElementsByTagName(
      "trkpt"
    );

  for (
    let i = 0;
    i < trkpts.length;
    i++
  ) {

    const trkpt =
      trkpts[i];

    const lat = Number(
      trkpt.getAttribute("lat")
    );

    const lng = Number(
      trkpt.getAttribute("lon")
    );

    const eleNode =
      trkpt.getElementsByTagName(
        "ele"
      )[0];
    

    const timeNode =
      trkpt.getElementsByTagName(
        "time"
      )[0];
    

    const elevation =
      eleNode
        ? Number(
            eleNode.textContent
          )
        : null;

    const timestamp =
      timeNode
        ? new Date(
            timeNode.textContent
          ).getTime()
        : null;
    
    if (i > 0) {
        const prev =
          routeData[i - 1];
        totalDistance +=
        calculateDistance(
          prev.lat,
          prev.lng,
          lat,
          lng
        );
    }

    let cumulativeDistance = totalDistance;

    routeData.push({
      lng,
      lat,

      elevation,

      timestamp,

      cumulativeDistance
    });
  }

  return routeData;
}

// MapLibre用のJSONファイル
function createGeoJSON(
  routeData
) {
  return {
    type:
      "FeatureCollection",

    features: [
      {
        type:
          "Feature",

        properties: {},

        geometry: {
          type:
            "LineString",

          coordinates:
            routeData.map(
              point => [
                point.lng,
                point.lat
              ]
            )
        }
      }
    ]
  };
}



// 動画時間の指定がない場合、総距離から動画時間を決定
const videoDuration = values.duration ? values.duration : Math.min(90, Math.max(15, totalDistance * 0.8));

// 時間からフレーム数を計算
const totalFrames =
  Math.floor(
    videoDuration * values.fps
  );
console.log({
  totalFrames,
});


// タイルサーバ起動
const tileServer = spawn(
  "npx",
  [
    "tileserver-gl",
    "--config",
    "conf.json"
  ],
  {
    cwd: '../server',
    stdio: "inherit"
  }
);
// MapLibre起動
const webServer = spawn(
  "npm",
  ["run", "dev"],
  {
    stdio: "inherit"
  }
);

async function waitForServer(
  url
) {
  while (true) {
    try {
      const res =
        await fetch(url);

      if (res.ok) return;

    } catch {}

    await new Promise(
      r => setTimeout(r, 500)
    );
  }
}

await Promise.all([
  waitForServer(
    "http://localhost:8080"
  ),

  waitForServer(
    "http://localhost:5173"
  )
]);

// previewオプションがtrueの場合はキャプチャを行わない
if(!values.preview) {
  console.log("capture start");
  // capture-videoにフレーム数を渡す
  execSync(
    "node capture.js",
    {
      stdio: "inherit",

      env: {
        ...process.env,

        TOTAL_FRAMES:
          String(totalFrames),
      },
    }
  );

  console.log("ffmpeg start");

  // MP4化
  execSync(`
  ffmpeg \
  -framerate ${values.fps} \
  -i frames/%06d.png \
  -c:v libx264 \
  -pix_fmt yuv420p \
  ${values.outputMP4}
  `, {
    stdio: "inherit",
  });

  console.log(
    `complete: ${values.outputMP4}`
  );

  tileServer.kill();

  webServer.kill();
}
