import maplibregl from "maplibre-gl";
import { gpx } from "@tmcw/togeojson";

const map = new maplibregl.Map({
  container: "map",

  style: "http://localhost:8080/styles/your_map_style/style.json",
  //style: "https://demotiles.maplibre.org/style.json",

  center: [135.5023, 34.6937],

  zoom: 11,
});

window.map = map;

window.mapReady = false;

map.addControl(new maplibregl.NavigationControl());

const routeData = await fetch(
  "/routeData.json"
).then(r => r.json());

const geojson = await fetch(
  "/route.geojson"
).then(r => r.json());

const params =
  new URLSearchParams(
    location.search
  );

const defaultTotalFrames =
  Number(
    params.get("frames")
  );

console.log(defaultTotalFrames);

const isCapture =
  new URLSearchParams(
    location.search
  ).get("capture") === "true";

const isRealtime =
  new URLSearchParams(
    location.search
  ).get("realtime") === "true";

if(isRealtime)console.log("real");

async function loadGPX() {
  console.log("Hello");
  const coordinates =
    geojson.features[0].geometry.coordinates;

  map.on("load", () => {
    window.mapReady = true;
    // 最初は空データ
    const animatedGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [],
      },
    };

    // source追加
    map.addSource("route", {
      type: "geojson",
      data: animatedGeoJSON,
    });

    // line追加
    map.addLayer({
      id: "route-line",

      type: "line",

      source: "route",

      paint: {
        "line-color": "#ff0000",

        "line-width": 5,
      },
    });

    // ルート範囲へ移動
    const bounds = coordinates.reduce(
      (bounds, coord) => {
        return bounds.extend(coord);
      },
      new maplibregl.LngLatBounds(
        coordinates[0],
        coordinates[0]
      )
    );

    map.fitBounds(bounds, {
      padding: 40,
    });

    createRenderer(routeData);
    
    // 1フレーム目が真っ白にならないための処理
    window.renderFrame(0, defaultTotalFrames);
    map.once("idle", () => {
    window.mapIdle = true;
    });

    if(!isCapture) {
      // アニメーション開始
      let frame = 0;
      setInterval(() => {
        window.renderFrame(frame, defaultTotalFrames);
        frame++;
      }, 33);
    }
    
  });
}

/*
function animateRoute(coordinates) {
  let i = 0;

  const source = map.getSource("route");

  const interval = setInterval(() => {
    if (i >= coordinates.length) {
      clearInterval(interval);

      return;
    }

    // 座標を少しずつ追加
    const currentCoords = coordinates.slice(0, i + 1);

    const updatedGeoJSON = {
      type: "Feature",

      geometry: {
        type: "LineString",

        coordinates: currentCoords,
      },
    };

    source.setData(updatedGeoJSON);

    // 現在位置
    const currentCoord = coordinates[i];

    // カメラ移動
    map.easeTo({
      center: currentCoord,

      duration: 100,

      zoom: 14,

      //bearing: 0,

      pitch: 30
    });

    i++;
  }, 30);
}
*/
/*
function animateRoute(
  routeData
) {
  const source =
    map.getSource("route");

  const totalDistance =
    routeData[
      routeData.length - 1
    ].cumulativeDistance;

  const totalFrames = 2700;

  let frame = 0;

  const interval =
    setInterval(() => {

      if (
        frame >= totalFrames
      ) {

        clearInterval(
          interval
        );

        return;
      }

      const progress =
        frame /
        (totalFrames - 1);

      const targetDistance =
        totalDistance *
        progress;
      
      const position =
        getPositionForFrame(
          frame,
          totalFrames,
          totalDistance,
          routeData
        );

      console.log({
        frame,
        targetDistance,
        totalDistance,
        position
      });
      
      console.log(
        routeData[0]
      );

      console.log(
        routeData[
          routeData.length - 1
        ]
      );

      const coordinates =
        getLineUpToDistance(
          routeData,
          targetDistance
        );

        source.setData({
        type: "Feature",

        geometry: {
          type: "LineString",

          coordinates
        }
      });

      map.jumpTo({
        center: [
          position.lng,
          position.lat
        ],

        zoom: 14,

        pitch: 30
      });

      frame++;

    }, 33);
}
*/

function createRenderer(routeData) {

  console.log(
  "createRenderer called"
  );

  const source = map.getSource("route");

  console.log("source", source);

  const totalDistance =
    routeData[
      routeData.length - 1
    ].cumulativeDistance;

  const startTime = routeData[0].timestamp;

  const totalTime =
    routeData[
      routeData.length - 1
    ].timestamp -
    routeData[0].timestamp;
  
  window.renderFrame =
    function(frame, totalFrames) {
      //console.log(arguments);

      const progress =
        frame /
        (totalFrames - 1);

      let targetDistance;
      if(!isRealtime) {
        targetDistance =
          totalDistance *
          progress;
      }else {
        console.log(totalTime, progress, startTime);
        targetDistance = 
          getDistanceAtTime(
            routeData,
            totalTime * progress + startTime
          );
      }

      console.log(targetDistance);

      console.log(
        "renderFrame",
        frame,
        totalFrames
      );
      

      const position =
        getPositionAtDistance(
          routeData,
          targetDistance
        );

      const coordinates =
        getLineUpToDistance(
          routeData,
          targetDistance
        );
      /*
      console.log(
      frame,
      coordinates.length
      );
      */

      source.setData({
        type: "Feature",

        geometry: {
          type: "LineString",

          coordinates
        }
      });

      const prev =
        getPositionAtDistance(
          routeData,
          targetDistance - 200
        );
      const next =
        getPositionAtDistance(
          routeData,
          targetDistance + 200
        );

      map.jumpTo({
        center: [
          position.lng,
          position.lat
        ],

        zoom: 14,

        pitch: 45,

        bearing: calculateBearing(prev, next)
      });

      window.lastRenderedFrame = frame;
    };
}

function getLineUpToDistance(
  routeData,
  targetDistance
) {

  const coordinates =
    [];

  for (let i = 0; i < routeData.length; i++) {

    const point =
      routeData[i];

    if (point.cumulativeDistance <= targetDistance) {
      coordinates.push([
          point.lng,
          point.lat
        ]);

    } else {

      break;
    }
  }

  const currentPosition =
    getPositionAtDistance(
      routeData,
      targetDistance
    );

  coordinates.push([
    currentPosition.lng,
    currentPosition.lat
  ]);

  return coordinates;
}

/*
function getPositionForFrame(
  frame,
  totalFrames,
  totalDistance,
  routeData
) {
  const progress =
    frame /
    (totalFrames - 1);

  const targetDistance =
    totalDistance * progress;

  return getPositionAtDistance(
    routeData,
    targetDistance
  );
}
*/

// スタート地点から指定された距離の座標を元のデータを線形補完して返す
function getPositionAtDistance(
  routeData,
  targetDistance
) {

  if (targetDistance <= 0) {
    return routeData[0];
  }

  const last =
    routeData[
      routeData.length - 1
    ];

  if (
    targetDistance >=
    last.cumulativeDistance
  ) {
    return last;
  }

  for (
    let i = 1;
    i < routeData.length;
    i++
  ) {

    const prev =
      routeData[i - 1];

    const next =
      routeData[i];

    if (
      targetDistance <=
      next.cumulativeDistance
    ) {

      const t =
        (
          targetDistance -
          prev.cumulativeDistance
        )
        /
        (
          next.cumulativeDistance -
          prev.cumulativeDistance
        );

      return {

        lng:
          prev.lng +
          (
            next.lng -
            prev.lng
          ) * t,

        lat:
          prev.lat +
          (
            next.lat -
            prev.lat
          ) * t,

        cumulativeDistance:
          targetDistance
      };
    }
  }

  return last;
}

function getDistanceAtTime(
  routeData,
  targetTime
) {
  if (targetTime <= routeData[0].timestamp) {
    return 0;
  }

  const last =
    routeData[
      routeData.length - 1
    ];

  if (
    targetTime >=
    last.timestamp
  ) {
    return last.cumulativeDistance;
  }

  for (
    let i = 1;
    i < routeData.length;
    i++
  ) {

    const prev =
      routeData[i - 1];

    const next =
      routeData[i];

    if (
      targetTime <=
      next.timestamp
    ) {

      const t =
        (
          targetTime -
          prev.timestamp
        )
        /
        (
          next.timestamp -
          prev.timestamp
        );

      return (
        prev.cumulativeDistance +
          (
            next.cumulativeDistance -
            prev.cumulativeDistance
          ) * t
      );
    }
  }

  return last;
}

// p1からp2への角度を返す
function calculateBearing(
  p1,
  p2
) {
  const dx =
    p2.lng - p1.lng;

  const dy =
    p2.lat - p1.lat;

  return (
    Math.atan2(dx, dy)
    * 180
    / Math.PI
    + 360
  ) % 360;
}


loadGPX();