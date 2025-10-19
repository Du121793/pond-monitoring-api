import { info, error } from "../logger.js";
const CWA_BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";

// --- 測站管理邏輯開始 ---
const DEFAULT_STATIONS = {
  surface: "467290", // 預設地面測站
  alternatives: ["467290", "467270", "467410", "467080", "466900", "466920"], // 備用測站列表
};

const RECOMMENDED_STATIONS = [
  {
    id: "467290",
    name: "古坑",
    nameEN: "Gukeng",
    county: "雲林縣",
    attribute: "署屬有人氣象站",
    description: "距離四湖蔡厝最近，雲林地區主要測站",
    priority: 1,
  },
  {
    id: "467270",
    name: "田中",
    nameEN: "TianZhong",
    county: "彰化縣",
    attribute: "署屬有人氣象站",
    description: "彰化地區測站，資料穩定",
    priority: 2,
  },
  {
    id: "467410",
    name: "臺南",
    nameEN: "TAINAN",
    county: "臺南市",
    attribute: "署屬有人氣象站",
    description: "臺南地區測站，資料豐富",
    priority: 3,
  },
];

// --- 測站管理邏輯結束 ---

// --- 天氣預報邏輯開始 ---
const COUNTY_DS_3DAY = {
  宜蘭縣: "F-D0047-001",
  桃園市: "F-D0047-005",
  新竹縣: "F-D0047-009",
  苗栗縣: "F-D0047-013",
  彰化縣: "F-D0047-017",
  南投縣: "F-D0047-021",
  雲林縣: "F-D0047-025",
  嘉義縣: "F-D0047-029",
  屏東縣: "F-D0047-033",
  臺東縣: "F-D0047-037",
  花蓮縣: "F-D0047-041",
  澎湖縣: "F-D0047-045",
  基隆市: "F-D0047-049",
  新竹市: "F-D0047-053",
  嘉義市: "F-D0047-057",
  臺北市: "F-D0047-061",
  高雄市: "F-D0047-065",
  新北市: "F-D0047-069",
  臺中市: "F-D0047-073",
  臺南市: "F-D0047-077",
  連江縣: "F-D0047-081",
  金門縣: "F-D0047-085",
};

// 根據縣市獲取一週天氣預報的資料集 ID
const countyWeekId = (county) => {
  const v = COUNTY_DS_3DAY[county];
  if (!v) return null;
  const n = String(parseInt(v.slice(-3), 10) + 2).padStart(3, "0");
  return `F-D0047-${n}`;
};
// --- 天氣預報邏輯結束 ---

// --- 天氣歷史邏輯開始 ---
const DATASETS = {
  HISTORICAL: {
    SURFACE_HOURLY: "C-B0024-001", // 每小時地面觀測資料
  },
};
// --- 天氣歷史邏輯結束 ---

export class WeatherModule {
  constructor(apiKey, debug = false) {
    this.apiKey = apiKey;
    this.debug = debug;
    this.defaultStations = { ...DEFAULT_STATIONS };
    this.defaultRegion = { county: "雲林縣", town: "四湖鄉" };
  }

  // 將物件轉換為查詢字串
  qs(obj) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj || {})) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
      else p.append(k, v);
    }
    return p.toString();
  }

  // 從 CWA API 獲取資料
  async fetchData(dataset, params = {}) {
    if (!this.apiKey) throw new Error("未設定 API 金鑰。");

    const url = `${CWA_BASE}/${dataset}?${this.qs({
      Authorization: this.apiKey,
      format: "JSON",
      ...params,
    })}`;

    if (this.debug) info("系統", `[CWA] GET ${url}`);

    const res = await fetch(url);
    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      error("系統", e);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    if (!json?.records) {
      throw new Error(`無效的回應格式: ${text.slice(0, 200)}`);
    }

    return json.records;
  }

  // --- 天氣預報方法開始 ---
  async getWeatherForecast(date, region = {}) {
    const targetDate = new Date(date);
    if (Number.isNaN(targetDate.getTime())) {
      throw new Error("無效的日期格式");
    }

    const r = { ...this.defaultRegion, ...region };
    const county = r.county;
    const town = r.town;
    const queryStartTime = new Date();

    const week = countyWeekId(county) || COUNTY_DS_3DAY[county];
    const dataset = week || COUNTY_DS_3DAY[county];

    if (!dataset) {
      throw new Error(`不支援的縣市: ${county}`);
    }

    try {
      const records = await this.fetchData(dataset);
      const container = this.pickLocationsContainer(records, county);
      const list = container.location || [];
      const want = this.normalizeHan(town);

      const target =
        list.find((x) => this.normalizeHan(x.locationName) === want) ||
        list.find((x) =>
          this.normalizeHan(x.locationName || "").includes(want)
        ) ||
        list[0];

      if (!target) {
        throw new Error(`找不到鄉鎮: ${town}`);
      }

      const weatherData = this.parseWeatherElements(
        target.weatherElement,
        targetDate
      );

      const zhToEn = {
        平均溫度: "AvgTemperature",
        最高溫度: "MaxTemperature",
        最低溫度: "MinTemperature",
        平均露點溫度: "DewPoint",
        平均相對濕度: "RelativeHumidity",
        最高體感溫度: "MaxApparentTemperature",
        最低體感溫度: "MinApparentTemperature",
        最大舒適度指數: "ComfortIndexMax",
        最小舒適度指數: "ComfortIndexMin",
        風速: "WindSpeed",
        風向: "WindDirection",
        "12小時降雨機率": "PrecipitationProbability12h",
        天氣現象: "WeatherCode",
        紫外線指數: "UVIndex",
        天氣預報綜合描述: "__DROP__", // 忽略此欄位
      };
      const toNumberIfNumeric = (v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
          return Number(v);
        }
        return v;
      };
      const pickEnglishOrNumber = (arr) => {
        if (!Array.isArray(arr)) return arr;
        const num = arr.find(
          (x) =>
            typeof x === "number" ||
            (typeof x === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(x))
        );
        if (num !== undefined) return num;
        const eng = arr.find(
          (x) => typeof x === "string" && /[A-Za-z]/.test(x)
        );
        if (eng !== undefined) return eng;
        return arr[0];
      };

      const forecastObj = {};
      for (const key in weatherData) {
        const enKey = zhToEn[key] ?? key;
        if (enKey === "__DROP__") continue;

        const arr = Object.values(weatherData[key]);
        let v = pickEnglishOrNumber(Array.isArray(arr) ? arr : [arr]);

        if (enKey === "WindSpeed") {
          v = toNumberIfNumeric(Array.isArray(arr) ? arr[0] : v);
        }

        if (enKey === "WindDirection") {
          v = Array.isArray(arr) ? arr[0] : v;
        }

        v = toNumberIfNumeric(v);
        forecastObj[enKey] = v;
      }
      forecastObj.DateTime = targetDate.toISOString();

      return forecastObj;
    } catch (e) {
      error("系統", e);
      return {
        success: false,
        error: e.message,
        date: targetDate.toISOString().split("T")[0],
        location: { county, town },
        queryTime: queryStartTime.toISOString(),
      };
    }
  }

  // 解析天氣元素
  parseWeatherElements(weatherElements, targetDate) {
    const result = {};
    const targetMs = targetDate.getTime();

    for (const we of weatherElements || []) {
      const elementName = we.elementName;
      if (!elementName) continue;

      const timeData = we.time || [];
      const targetTimeData = this.findTargetTimeData(
        timeData,
        targetMs,
        elementName
      );

      if (targetTimeData) {
        result[elementName] = this.extractElementValue(
          targetTimeData.elementValue
        );
      }
    }
    return result;
  }

  // 尋找目標時間資料
  findTargetTimeData(timeArray, targetMs, elementName) {
    for (const timeData of timeArray) {
      const startTime = this.parseCwaTime(timeData.startTime);
      const endTime = this.parseCwaTime(timeData.endTime);

      if (startTime && endTime) {
        const startMs = startTime.getTime();
        const endMs = endTime.getTime();
        if (targetMs >= startMs && targetMs < endMs) {
          return timeData;
        }
      }
    }

    let bestMatch = null;
    let minDiff = Infinity;

    for (const timeData of timeArray) {
      const startTime = this.parseCwaTime(timeData.startTime);
      if (!startTime) continue;

      const startMs = startTime.getTime();
      const diff = Math.abs(targetMs - startMs);

      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = timeData;
      }
    }
    return bestMatch || timeArray[0] || null;
  }

  // 提取元素值
  extractElementValue(elementValue) {
    if (!elementValue) return null;
    if (Array.isArray(elementValue)) {
      if (elementValue.length === 1) {
        return elementValue[0];
      }
      return elementValue;
    }
    return elementValue;
  }

  // 挑選地點容器
  pickLocationsContainer(rec, fallbackCounty) {
    const found = this.deepFindLocationsArray(rec, 7);
    if (found) {
      const loc = found.location.map((x) => this.normalizeTownshipObj(x));
      return {
        locationsName: found.locationsName || fallbackCounty || null,
        location: loc,
      };
    }

    const locArr = (this.G(rec, ["location", "Location"]) || []).map((x) =>
      this.normalizeTownshipObj(x)
    );
    const locationsName =
      this.G(rec, ["locationsName", "LocationsName"]) || fallbackCounty || null;
    return { locationsName, location: locArr };
  }

  // 深度尋找地點陣列
  deepFindLocationsArray(root, maxDepth = 7) {
    const stack = [
      {
        node: root,
        depth: 0,
        meta: this.G(root, ["locationsName", "LocationsName"]) || null,
      },
    ];
    const seen = new Set();

    while (stack.length) {
      const { node, depth, meta } = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (seen.has(node)) continue;
      seen.add(node);

      if (Array.isArray(node)) {
        if (node.some((obj) => this.looksLikeTownship(obj))) {
          return { locationsName: meta || null, location: node };
        }
        if (depth < maxDepth) {
          node.forEach((v) => stack.push({ node: v, depth: depth + 1, meta }));
        }
        continue;
      }

      const subs = [
        this.G(node, ["locations", "Locations"]),
        this.G(node, ["location", "Location"]),
      ];
      const ln =
        this.G(node, ["locationsName", "LocationsName"]) || meta || null;

      for (const sub of subs) {
        if (!sub) continue;
        if (
          Array.isArray(sub) &&
          sub.some((obj) => this.looksLikeTownship(obj))
        ) {
          return { locationsName: ln, location: sub };
        }
        if (typeof sub === "object") {
          const arr = this.G(sub, ["location", "Location"]);
          const ln2 = this.G(sub, ["locationsName", "LocationsName"]) || ln;
          if (
            Array.isArray(arr) &&
            arr.some((obj) => this.looksLikeTownship(obj))
          ) {
            return { locationsName: ln2, location: arr };
          }
          if (depth < maxDepth) {
            stack.push({ node: sub, depth: depth + 1, meta: ln2 });
          }
        }
      }

      if (depth < maxDepth) {
        for (const [k, v] of Object.entries(node)) {
          const m = k === "locationsName" || k === "LocationsName" ? v : meta;
          stack.push({ node: v, depth: depth + 1, meta: m });
        }
      }
    }
    return null;
  }

  // 判斷是否像鄉鎮物件
  looksLikeTownship(obj) {
    const name = this.G(obj, ["locationName", "LocationName"]);
    const we = this.G(obj, [
      "weatherElement",
      "WeatherElement",
      "weatherElements",
      "WeatherElements",
    ]);
    return typeof name === "string" && Array.isArray(we);
  }

  // 標準化鄉鎮物件
  normalizeTownshipObj(x) {
    const locationName = this.G(x, ["locationName", "LocationName"]);
    const paramRaw = this.G(x, ["parameter", "Parameter"]) || [];
    const parameter = paramRaw.map((p) => ({
      parameterName: this.G(p, ["parameterName", "ParameterName"]),
      parameterValue: this.G(p, ["parameterValue", "ParameterValue"]),
    }));
    const weRaw =
      this.G(x, [
        "weatherElement",
        "WeatherElement",
        "weatherElements",
        "WeatherElements",
      ]) || [];

    const weatherElement = weRaw.map((we) => {
      const elementName = this.G(we, ["elementName", "ElementName"]);
      const timeRaw = this.G(we, ["time", "Time"]) || [];
      const time = timeRaw.map((t) => {
        let st = this.G(t, ["startTime", "StartTime", "dataTime", "DataTime"]);
        let et = this.G(t, ["endTime", "EndTime", "dataTime", "DataTime"]);
        let elementValue = this.G(t, ["elementValue", "ElementValue"]);
        if (elementValue && !Array.isArray(elementValue)) {
          elementValue = [elementValue];
        }
        return { startTime: st, endTime: et, elementValue };
      });
      return { elementName, time };
    });

    return { locationName, parameter, weatherElement };
  }

  // 安全地獲取物件屬性
  G(obj, keys) {
    for (const k of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    }
    return null;
  }

  // 標準化中文字元
  normalizeHan(str) {
    return String(str || "")
      .trim()
      .replace(/台/g, "臺");
  }

  // 解析 CWA 時間字串
  parseCwaTime(timeStr) {
    if (!timeStr) return null;
    let s = String(timeStr).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T]24:00:00/);
    if (m) {
      const d = new Date(`${m[1]}T00:00:00+08:00`);
      if (!Number.isNaN(d)) {
        d.setDate(d.getDate() + 1);
        return d;
      }
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
      s = s.replace(" ", "T") + "+08:00";
    }
    const d = new Date(s);
    return Number.isNaN(d) ? null : d;
  }
  // --- 天氣預報方法結束 ---

  // --- 天氣歷史方法開始 ---
  async getHistoricalWeather(
    date,
    stationId = null,
    timeRange = { hours: 24, minutes: 0 }
  ) {
    const targetDate = new Date(date);
    if (Number.isNaN(targetDate.getTime())) {
      throw new Error("無效的日期格式");
    }

    const station = stationId || this.defaultStations.surface;
    const queryStartTime = new Date();

    try {
      const hours = timeRange.hours || 24;
      const minutes = timeRange.minutes || 0;
      const totalMs = (hours * 60 + minutes) * 60 * 1000;

      const timeFrom = new Date(targetDate.getTime() - totalMs);
      const timeTo = new Date(targetDate.getTime() + totalMs);

      const records = await this.fetchData(DATASETS.HISTORICAL.SURFACE_HOURLY, {
        stationId: station,
        timeFrom: timeFrom.toISOString(),
        timeTo: timeTo.toISOString(),
      });

      const weatherData = this.parseHistoricalData(records, targetDate);

      const historyObj = {};
      for (const key in weatherData) {
        if (!/\w/.test(key)) continue;

        let v = weatherData[key];
        if (key === "WindDirection") {
          v = String(v).split(",")[0];
        } else {
          v = this.toNumberIfNumeric(v);
        }
        historyObj[key] = v;
      }
      historyObj.DateTime = targetDate.toISOString();

      return historyObj;
    } catch (e) {
      error("系統", e);
      return {
        success: false,
        error: e.message,
        date: targetDate.toISOString().split("T")[0],
        station: { id: station, type: "surface" },
        queryTime: queryStartTime.toISOString(),
      };
    }
  }

  // 如果是數字字串，則轉換為數字
  toNumberIfNumeric(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
      return Number(v);
    }
    return v;
  }

  // 解析歷史資料
  parseHistoricalData(records, targetDate) {
    let locations = [];
    if (records.locations?.location) {
      locations = Array.isArray(records.locations.location)
        ? records.locations.location
        : [records.locations.location];
    } else if (records.location) {
      locations = Array.isArray(records.location)
        ? records.location
        : [records.location];
    } else if (records.Station) {
      locations = Array.isArray(records.Station)
        ? records.Station
        : [records.Station];
    }

    if (locations.length === 0) {
      return {};
    }

    const location = locations[0];
    let weatherData = {};

    if (location.stationObsTimes?.stationObsTime) {
      const obsTimes = Array.isArray(location.stationObsTimes.stationObsTime)
        ? location.stationObsTimes.stationObsTime
        : [location.stationObsTimes.stationObsTime];

      const targetTime = targetDate.getTime();
      let closestObs = null;
      let minDiff = Infinity;

      for (const obs of obsTimes) {
        if (obs.DateTime) {
          const obsTime = new Date(obs.DateTime).getTime();
          const diff = Math.abs(obsTime - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestObs = obs;
          }
        }
      }

      if (closestObs) {
        weatherData = this.parseObsTimeData(closestObs);
      }
    }

    if (
      Object.keys(weatherData).length === 0 &&
      location.stationObsStatistics
    ) {
      weatherData = this.parseObsStatistics(location.stationObsStatistics);
    }

    return weatherData;
  }

  // 清理降水資料
  cleanPrecipitationData(value) {
    const PRECIPITATION_MAPPING = {
      T: 0.1,
      t: 0.1,
      TR: 0.1,
      tr: 0.1,
      M: 0,
      m: 0,
      "N/A": null,
      "n/a": null,
      "--": null,
      "-": null,
      "": null,
    };
    if (value === null || value === undefined) {
      return null;
    }
    const strValue = String(value).trim();
    if (PRECIPITATION_MAPPING.hasOwnProperty(strValue)) {
      return PRECIPITATION_MAPPING[strValue];
    }
    const numValue = parseFloat(strValue);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }
    return null;
  }

  // 解析觀測時間資料
  parseObsTimeData(obsTime) {
    const result = {};
    const fieldMappings = {
      AirPressure: "氣壓",
      AirTemperature: "氣溫",
      RelativeHumidity: "相對濕度",
      WindSpeed: "風速",
      WindDirection: "風向",
      Precipitation: "降水量",
      SunshineDuration: "日照時數",
    };

    if (obsTime.weatherElements) {
      const elements = obsTime.weatherElements;
      for (const [field, description] of Object.entries(fieldMappings)) {
        if (
          elements[field] !== undefined &&
          elements[field] !== null &&
          elements[field] !== ""
        ) {
          if (field === "Precipitation") {
            const cleanedValue = this.cleanPrecipitationData(elements[field]);
            result[description] = cleanedValue;
            result[field] = cleanedValue;
          } else {
            result[description] = elements[field];
            result[field] = elements[field];
          }
        }
      }
    }

    if (obsTime.DateTime) {
      result["觀測時間"] = obsTime.DateTime;
      result["DateTime"] = obsTime.DateTime;
    }

    return result;
  }

  // 解析觀測統計資料
  parseObsStatistics(statistics) {
    const result = {};
    if (statistics.AirTemperature) {
      const temp = statistics.AirTemperature;
      if (temp.daily && Array.isArray(temp.daily) && temp.daily.length > 0) {
        const dailyData = temp.daily[0];
        if (dailyData.Maximum !== undefined)
          result["最高氣溫"] = dailyData.Maximum;
        if (dailyData.Minimum !== undefined)
          result["最低氣溫"] = dailyData.Minimum;
        if (dailyData.Mean !== undefined) result["平均氣溫"] = dailyData.Mean;
        if (dailyData.Date) result["統計日期"] = dailyData.Date;
      } else {
        if (temp.Maximum !== undefined) result["最高氣溫"] = temp.Maximum;
        if (temp.Minimum !== undefined) result["最低氣溫"] = temp.Minimum;
        if (temp.Mean !== undefined) result["平均氣溫"] = temp.Mean;
      }
    }
    for (const [key, value] of Object.entries(statistics)) {
      if (value !== undefined && value !== null && key !== "AirTemperature") {
        result[key] = value;
      }
    }
    return result;
  }
  // --- 天氣歷史方法結束 ---
}
