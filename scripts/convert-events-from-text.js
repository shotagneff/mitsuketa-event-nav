// 簡易変換スクリプト
// data/raw-events.txt に貼ったテキストから、イベント1本ごとのJSON配列を標準出力に出す
// 使い方:
//   node scripts/convert-events-from-text.js > data/events.generated.json

const fs = require("fs");
const path = require("path");

const rawPath = path.join(__dirname, "..", "data", "raw-events.txt");

function readRaw() {
  try {
    return fs.readFileSync(rawPath, "utf8");
  } catch (e) {
    console.error("raw-events.txt が見つかりませんでした: ", rawPath);
    process.exit(1);
  }
}

function normalizeDate(jpDateLine) {
  const m = jpDateLine.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const [_, y, mo, d] = m;
  const mm = mo.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function detectModeAndPlace(line) {
  let mode = null;
  let place = null;

  if (line.includes("WEB開催") || line.includes("WEB") || line.includes("オンライン")) {
    mode = "オンライン";
    place = "オンライン";
  }

  if (line.includes("東京会場") || line.includes("首都圏")) {
    mode = mode || "オフライン";
    place = "東京";
  }

  if (line.includes("名古屋会場") || line.includes("東海")) {
    mode = mode || "オフライン";
    place = "名古屋";
  }

  return { mode, place };
}

function parseBlock(block, index) {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return null;

  const header = lines[0];
  const date = normalizeDate(header);
  const { mode, place } = detectModeAndPlace(header);

  const joined = lines.join("\n");

  const companyMatch = joined.match(/企業数：(\d+)社/);
  const capacityMatch = joined.match(/定員：(\d+)名/);

  const companyCount = companyMatch ? Number(companyMatch[1]) : null;
  const capacity = capacityMatch ? Number(capacityMatch[1]) : null;

  return {
    id: `event-${index + 1}`,
    name: header, // 必要に応じてあとで編集
    date,
    place,
    mode,
    type: null, // 手で埋める想定
    industries: [], // 手で埋める想定
    experiences: [], // 手で埋める想定
    description: "",
    companyCount,
    capacity,
    benefits: "",
    imageUrl: "",
    reserveUrl: "", // 各イベントごとのLINE URL
    rawDetail: joined,
  };
}

function main() {
  const raw = readRaw();

  // ざっくり: 「YYYY年MM月DD日」で始まる行ごとにブロックに分ける
  const lines = raw.split(/\r?\n/);
  const blocks = [];
  let current = [];

  const dateHeadRegex = /^\s*\d{4}年\d{1,2}月\d{1,2}日/;

  for (const line of lines) {
    if (dateHeadRegex.test(line)) {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
      }
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  const events = blocks
    .map((block, idx) => parseBlock(block, idx))
    .filter((e) => e !== null);

  process.stdout.write(JSON.stringify(events, null, 2));
}

main();
