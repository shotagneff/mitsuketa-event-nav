const fs = require("fs");
const path = require("path");

// 想定するCSVパス: data/events-sheet.csv
// 使い方:
//   node scripts/convert-events-from-csv.js > data/events.json

const csvPath = path.join(__dirname, "..", "data", "events-sheet.csv");

function readCsv() {
  try {
    return fs.readFileSync(csvPath, "utf8");
  } catch (e) {
    console.error("events-sheet.csv が見つかりませんでした: ", csvPath);
    process.exit(1);
  }
}

// シンプルなCSVパーサ（カンマ区切り、ダブルクオートは軽く対応）
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = cols[idx] !== undefined ? cols[idx].trim() : "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 連続する "" はエスケープされた " とみなす
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function toArray(value) {
  if (!value) return [];
  // カンマ or 日本語の読点で区切る
  return value
    .split(/[、,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function decideImageUrl(companyName = "", programName = "") {
  const base = "/images/events";
  const text = `${companyName} ${programName}`;

  if (text.includes("WinC") || text.includes("プレシャスパートナーズ")) {
    return `${base}/winc.png`;
  }
  if (text.includes("cheer") || text.includes("チアフェス") || text.includes("cheer")) {
    return `${base}/cheer-fes.png`;
  }
  if (text.includes("HRteam") || text.includes("ジョブハント")) {
    return `${base}/hrteam-jobhunt.png`;
  }
  if (text.includes("DYM") || text.includes("Meets Company")) {
    return `${base}/dym-meets-company.png`;
  }
  if (text.includes("社長メシ") || text.includes("就活メシ")) {
    return `${base}/shachomeshi.png`;
  }

  // デフォルト: プレースホルダー
  return `${base}/default.png`;
}

function mapRowToEvent(row, index) {
  const id = row.id || `event-${index + 1}`;
  const companyName = row.companyName || "";
  const programName = row.programName || "";
  const name = programName || companyName || id;

  const date = row.date || "";
  const place = row.place || "";
  const type = row.type || "";
  const industries = toArray(row.industries);
  const experiences = toArray(row.experiences);
  const description = row.conceptSummary || "";

  const companyCount = row.companyCount ? Number(row.companyCount) : 0;
  const capacity = row.capacity ? Number(row.capacity) : 0;

  const reserveUrl = row.reserveUrl || "";
  const time = row.time || "";

  const imageUrl = decideImageUrl(companyName, programName);

  return {
    id,
    name,
    date,
    place,
    time,
    type,
    industries,
    experiences,
    description,
    companyCount,
    capacity,
    benefits: "",
    imageUrl,
    reserveUrl,
  };
}

function main() {
  const csvText = readCsv();
  const rows = parseCsv(csvText);
  const events = rows.map((row, idx) => mapRowToEvent(row, idx));
  process.stdout.write(JSON.stringify(events, null, 2));
}

main();
