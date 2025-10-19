import sharp from "sharp";
import { error as logError } from "../logger.js";

/**
 * 從 base64 編碼的圖片的指定圓形區域提取平均 RGB 值。
 * @param {string} base64Data - base64 編碼的圖片資料。
 * @returns {Promise<{r: number, g: number, b: number}|null>} - 返回平均 RGB 值，如果發生錯誤則返回 null。
 */
export const extractRgbFromImage = async (base64Data) => {
  try {
    const m = String(base64Data).match(/^data:image\/\w+;base64,(.+)$/i);
    const b64 = m ? m[1] : base64Data;
    const buffer = Buffer.from(b64, "base64");

    const image = sharp(buffer);
    const metadata = await image.metadata();

    const width = metadata.width;
    const height = metadata.height;

    // 計算圓心和半徑
    const cx = (width * 7) / 24;
    const cy = height * (2 / 3);
    const radius = width / 8;

    // 建立 SVG 圓形遮罩
    const circleSvg = `
      <svg width="${width}" height="${height}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="white" />
      </svg>
    `;

    // 應用遮罩並提取統計數據
    const { channels } = await image
      .composite([
        {
          input: Buffer.from(circleSvg),
          blend: "in",
        },
      ])
      .stats();

    // 從統計數據中獲取平均 RGB
    const [r, g, b] = channels.map((c) => Math.round(c.mean));

    return { r, g, b };
  } catch (err) {
    logError("系統", err, { body: "從圖片提取 RGB 時發生錯誤" });
    return null;
  }
};
