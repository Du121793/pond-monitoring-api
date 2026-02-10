import { createNewRecord } from "../SQL_Controller/sensor_record.js";
import { updateSensorLocalIpIfChanged } from "../SQL_Controller/sensors.js";
import { extractRgbFromImage } from "./rgb/extractor.js";
import { error as logError } from "./logger.js";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOADS_DIR = "./uploads";
const MAX_IMAGES = 3;

const saveAndProcessImage = async (photoB64) => {
  try {
    const match = String(photoB64).match(/^data:image\/\w+;base64,(.+)$/i);
    const base64Data = match ? match[1] : photoB64;
    const buffer = Buffer.from(base64Data, "base64");

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    const cx = (width * 7) / 24;
    const cy = height * (2 / 3);
    const radius = width / 8;

    const circleSvg = `
      <svg width="${width}" height="${height}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="red" stroke-width="5" />
      </svg>
    `;

    const imageWithCircle = await image
      .composite([{
        input: Buffer.from(circleSvg),
        top: 0,
        left: 0,
      }])
      .toBuffer();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `capture-${timestamp}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filepath, imageWithCircle);

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
    logError("\u5f71\u50cf", err, { message: "\u5f71\u50cf\u8655\u7406\u5931\u6557" });
  }
};

export const handleSensorData = async (sensorData) => {
  const {
    photo_b64,
    date,
    created_at: createdAt,
    local_ip,
    sensorId: _sensorId,
    pond_id: _pondId,
    ...otherData
  } = sensorData;

  let rgb = null;
  if (photo_b64) {
    rgb = await extractRgbFromImage(photo_b64);
    await saveAndProcessImage(photo_b64);
  }

  const dataToProcess = {
    ...otherData,
    rgb_r: rgb?.r,
    rgb_g: rgb?.g,
    rgb_b: rgb?.b,
  };

  if (date || createdAt) {
    dataToProcess.created_at = date || createdAt;
  }

  try {
    if (local_ip && otherData.sensor_id) {
      await updateSensorLocalIpIfChanged(otherData.sensor_id, local_ip);
    }

    return await createNewRecord(dataToProcess);
  } catch (err) {
    logError("\u611f\u6e2c\u5668", err, { body: sensorData });
    throw err;
  }
};
