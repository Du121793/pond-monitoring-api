const getFormattedDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const escapeUnicode = (value) =>
  String(value).replace(/[\u007f-\uffff]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  );

const stringifyForLog = (value) => {
  try {
    return escapeUnicode(JSON.stringify(value));
  } catch {
    return escapeUnicode(String(value));
  }
};

const info = (actor, action, ip = "") => {
  const ipPart = ip ? `[${ip}]` : "";
  console.log(`[INFO][${actor}]${ipPart}[${getFormattedDate()}] ${action}`);
};

const error = (actor, err, req = null) => {
  const ip = req ? `[${req.ip}]` : "";
  const data =
    req && req.body ? `[傳入資料: ${stringifyForLog(req.body)}]` : "";
  const message = err?.message ? escapeUnicode(err.message) : "Unknown error";
  const errorMessage = `
[ERROR][${actor}]${ip}[${getFormattedDate()}]${data}
錯誤簡述: "${message}"
詳細錯誤:
`;
  console.error(errorMessage, err);
};

export {
  info,
  error,
};
