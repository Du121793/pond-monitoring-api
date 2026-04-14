import { insertWeatherObservationRawBatch } from "../../SQL_Controller/weatherObservationRawQueries.js";
import { info } from "../logger.js";

const CWA_BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";
const TARGET_STATION_ID = "C2K280";
const DATASETS = ["O-A0001-001", "O-A0002-001"];

function pickWgs84Coordinate(geoInfo) {
  const coordinates = geoInfo?.Coordinates ?? [];
  return (
    coordinates.find((item) => item?.CoordinateName === "WGS84") ||
    coordinates[0] ||
    {}
  );
}

function cleanWeatherText(value) {
  if (!value || value === "-99") return null;
  return value;
}

async function fetchStationDataset(apiKey, datasetId) {
  const url = new URL(`${CWA_BASE}/${datasetId}`);
  url.searchParams.set("Authorization", apiKey);
  url.searchParams.set("format", "JSON");
  url.searchParams.set("StationId", TARGET_STATION_ID);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CWA ${datasetId} 取得失敗，HTTP 狀態碼: ${response.status}`);
  }

  const json = await response.json();
  if (json.success !== "true" && json.success !== true) {
    throw new Error(`CWA ${datasetId} 回傳失敗狀態: ${json.success}`);
  }

  return json.records?.Station ?? [];
}

function baseRowFromStation(datasetId, station, fetchedAt) {
  const coord = pickWgs84Coordinate(station.GeoInfo);

  return {
    stationId: station.StationId,
    stationName: station.StationName,
    datasetId,
    observedAt: station.ObsTime?.DateTime,
    fetchedAt,
    sourcePayload: station,
    countyName: station.GeoInfo?.CountyName,
    townName: station.GeoInfo?.TownName,
    stationLatitude: coord.StationLatitude,
    stationLongitude: coord.StationLongitude,
    stationAltitude: station.GeoInfo?.StationAltitude,
  };
}

function parseWeatherRow(datasetId, station, fetchedAt) {
  const element = station.WeatherElement ?? {};

  return {
    ...baseRowFromStation(datasetId, station, fetchedAt),
    weather: cleanWeatherText(element.Weather),
    airPressure: element.AirPressure,
    airTemperature: element.AirTemperature,
    relativeHumidity: element.RelativeHumidity,
    windSpeed: element.WindSpeed,
    windDirection: element.WindDirection,
    precipitation: element.Now?.Precipitation,
    sunshineDuration: element.SunshineDuration,
  };
}

function parseRainfallRow(datasetId, station, fetchedAt) {
  const element = station.RainfallElement ?? {};

  return {
    ...baseRowFromStation(datasetId, station, fetchedAt),
    precipitation: element.Now?.Precipitation,
    precipitation10min: element.Past10Min?.Precipitation,
    precipitation1hr: element.Past1hr?.Precipitation,
    precipitation3hr: element.Past3hr?.Precipitation,
    precipitation6hr: element.Past6Hr?.Precipitation,
    precipitation12hr: element.Past12hr?.Precipitation,
    precipitation24hr: element.Past24hr?.Precipitation,
    precipitation2days: element.Past2days?.Precipitation,
    precipitation3days: element.Past3days?.Precipitation,
  };
}

function parseDatasetRows(datasetId, stations, fetchedAt) {
  return stations
    .filter((station) => station?.StationId === TARGET_STATION_ID)
    .map((station) => {
      if (datasetId === "O-A0002-001") {
        return parseRainfallRow(datasetId, station, fetchedAt);
      }
      return parseWeatherRow(datasetId, station, fetchedAt);
    })
    .filter((row) => row.observedAt);
}

export async function fetchC2K280RawObservationRows(apiKey) {
  if (!apiKey) {
    throw new Error("缺少 WEATHER_API_KEY，無法同步 C2K280 原始觀測資料");
  }

  const fetchedAt = new Date();
  const datasetResults = await Promise.all(
    DATASETS.map(async (datasetId) => ({
      datasetId,
      stations: await fetchStationDataset(apiKey, datasetId),
    }))
  );

  return datasetResults.flatMap(({ datasetId, stations }) =>
    parseDatasetRows(datasetId, stations, fetchedAt)
  );
}

export async function fetchAndStoreC2K280RawObservations(apiKey) {
  const rows = await fetchC2K280RawObservationRows(apiKey);
  const insertedRows = await insertWeatherObservationRawBatch(rows);

  info(
    "天氣原始資料",
    `C2K280 原始觀測資料同步完成：取得 ${rows.length} 筆，寫入/更新 ${insertedRows.length} 筆`
  );

  return insertedRows;
}
