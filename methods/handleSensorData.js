import {
  findMergeableRecord,
  createNewRecord,
  mergeRecord,
} from "../SQL_Controller/sensor_record.js";
import { extractRgbFromImage } from "./rgb/extractor.js";
import { error as logError } from "./logger.js";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOADS_DIR = "./uploads";
const MAX_IMAGES = 3;

// 儲存並處理圖片
const saveAndProcessImage = async (photoB64) => {
  try {
    // 匹配並提取 base64 資料
    const match = String(photoB64).match(/^data:image\/\w+;base64,(.+)$/i);
    const base64Data = match ? match[1] : photoB64;
    const buffer = Buffer.from(base64Data, "base64");

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    // 計算圓心和半徑
    const cx = (width * 7) / 24;
    const cy = height * (2 / 3);
    const radius = width / 8;

    // 建立 SVG 圓形以標示擷取區域
    const circleSvg = `
      <svg width="${width}" height="${height}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="red" stroke-width="5" />
      </svg>
    `;

    // 將圓形疊加到原始圖片上
    const imageWithCircle = await image
      .composite([{
        input: Buffer.from(circleSvg),
        top: 0,
        left: 0,
      }])
      .toBuffer();

    // 儲存圖片
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `capture-${timestamp}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filepath, imageWithCircle);

    // 管理圖片數量
    const files = await fs.readdir(UPLOADS_DIR);
    if (files.length > MAX_IMAGES) {
      const sortedFiles = files
        .map((file) => {
          const timestampStr = file
            .replace("capture-", "")
            .replace(".jpg", "")
            .replace(/T/g, " ")
            .replace(/-/g, ":");
          return {
            name: file,
            time: new Date(timestampStr),
          };
        })
        .sort((a, b) => a.time - b.time);

      if (sortedFiles.length > 0) {
        const oldestFile = sortedFiles[0];
        await fs.unlink(path.join(UPLOADS_DIR, oldestFile.name));
      }
    }
  } catch (err) {
    logError("系統", err, { message: "處理或儲存圖片時發生錯誤" });
  }
};

// 核心感測器資料處理函式
export const handleSensorData = async (sensorData) => {
  const { photo_b64, ...otherData } = sensorData;

  let rgb = null;
  // 如果有 photo_b64，則提取 RGB 並處理圖片
  if (photo_b64) {
    rgb = await extractRgbFromImage(photo_b64);
    await saveAndProcessImage(photo_b64); // 處理並儲存圖片
  }

  const hasRGB = rgb !== null;
  const dataToProcess = {
    ...otherData, // 包含 pond_id 和所有其他感測器數值
    rgb_r: rgb?.r,
    rgb_g: rgb?.g,
    rgb_b: rgb?.b,
  };

  try {
    // 尋找可合併的紀錄
    const mergeableRecord = await findMergeableRecord(
      dataToProcess.pond_id,
      hasRGB
    );

    if (mergeableRecord) {
      // 如果找到，則合併紀錄
      return await mergeRecord(mergeableRecord.id, dataToProcess);
    } else {
      // 否則，建立一筆新紀錄
      return await createNewRecord(dataToProcess);
    }
  } catch (err) {
    logError("系統", err, { body: sensorData });
    throw err;
  }
};
