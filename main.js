import maplibregl from "maplibre-gl";
import { gpx } from "@tmcw/togeojson";

const map = new maplibregl.Map({
  container: "map",

  style: "http://localhost:8080/styles/your_map_style/style.json",

  center: [135.5023, 34.6937],

  zoom: 11,
});

window.mapReady = false;

map.addControl(new maplibregl.NavigationControl());

async function loadGPX() {
  const response = await fetch("./route.gpx");

  const text = await response.text();
  
  const parser = new DOMParser();
  const xml = parser.parseFromString(
    text,
    "text/xml"
  );

  const geojson = gpx(xml);

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

    // アニメーション開始
    animateRoute(coordinates);
  });
}

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

loadGPX();