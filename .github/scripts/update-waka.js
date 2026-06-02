const fs = require("fs");
const path = require("path");
const https = require("https");

const START_MARK = "<!--START_SECTION:waka-->";
const END_MARK = "<!--END_SECTION:waka-->";

const WAKATIME_API_KEY = process.env.WAKATIME_API_KEY;

if (!WAKATIME_API_KEY) {
  console.error("Missing WAKATIME_API_KEY");
  process.exit(1);
}

function wakaFetch(urlPath) {
  const url = `https://wakatime.com/api/v1/users/current/${urlPath}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString("base64")}`,
          "User-Agent": "github-action-waka-readme",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Status ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
  });
}

function formatBar(percent, width = 25) {
  const filled = Math.round((percent / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function formatTime(hours, minutes) {
  if (typeof hours !== "number" || typeof minutes !== "number") return "";
  return `${hours}h ${minutes}m`;
}

function formatLine(name, percent, hours, minutes) {
  const namePad = name.padEnd(20);
  const timePad = formatTime(hours, minutes).padEnd(12);
  const bar = formatBar(percent);
  return `${namePad}${timePad}${bar}  ${percent.toFixed(2)} %`;
}

function formatJST(date, includeTime = true) {
  if (!date || isNaN(date.getTime())) return "N/A";
  const options = {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.second = "2-digit";
    options.hour12 = false;
  }
  const formatter = new Intl.DateTimeFormat("ja-JP", options);
  const parts = formatter.formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  let result = `${get("year")}年${get("month")}月${get("day")}日`;
  if (includeTime) result += ` ${get("hour")}:${get("minute")}:${get("second")} JST`;
  return result;
}

function renderMarkdown(stats, insights) {
  const now = new Date();
  let md = "";

  // Header
  md += `**📊 Weekly Development Breakdown** · \`${formatJST(now)}\`\n\n`;

  // AI vs Human coding stats
  const aiCategory = (stats.categories || []).find(
    (c) => c.name.toLowerCase() === "ai coding"
  );
  const codingCategory = (stats.categories || []).find(
    (c) => c.name.toLowerCase() === "coding"
  );

  if (aiCategory || codingCategory) {
    md += "**🤖 AI Coding vs Human Coding**\n\n";
    md += "```text\n";
    if (aiCategory) {
      md += `AI Coding           ${formatTime(aiCategory.hours, aiCategory.minutes).padEnd(12)}${formatBar(aiCategory.percent)}  ${aiCategory.percent.toFixed(2)} %\n`;
    }
    if (codingCategory) {
      md += `Human Coding        ${formatTime(codingCategory.hours, codingCategory.minutes).padEnd(12)}${formatBar(codingCategory.percent)}  ${codingCategory.percent.toFixed(2)} %\n`;
    }
    md += "```\n\n";
  }

  // AI line changes
  if (stats.ai_additions != null || stats.ai_deletions != null) {
    const aiAdd = stats.ai_additions || 0;
    const aiDel = stats.ai_deletions || 0;
    const humanAdd = stats.human_additions || 0;
    const humanDel = stats.human_deletions || 0;
    const totalAdd = aiAdd + humanAdd;
    const totalDel = aiDel + humanDel;
    const aiAddPct = totalAdd > 0 ? ((aiAdd / totalAdd) * 100).toFixed(1) : "0.0";
    const humanAddPct = totalAdd > 0 ? ((humanAdd / totalAdd) * 100).toFixed(1) : "0.0";

    md += "**📝 Line Changes (AI vs Human)**\n\n";
    md += "```text\n";
    md += `             Additions    Deletions\n`;
    md += `🤖 AI        +${String(aiAdd).padEnd(10)} -${String(aiDel).padEnd(10)}  (${aiAddPct}% of additions)\n`;
    md += `👨‍💻 Human     +${String(humanAdd).padEnd(10)} -${String(humanDel).padEnd(10)}  (${humanAddPct}% of additions)\n`;
    md += "```\n\n";
  }

  // Languages (top 5)
  if (stats.languages && stats.languages.length > 0) {
    md += "**💻 Languages**\n\n";
    md += "```text\n";
    for (let i = 0; i < Math.min(5, stats.languages.length); i++) {
      const lang = stats.languages[i];
      md += `${formatLine(lang.name, lang.percent, lang.hours, lang.minutes)}\n`;
    }
    md += "```\n\n";
  }

  // Editors
  if (stats.editors && stats.editors.length > 0) {
    md += "**🛠️ Editors**\n\n";
    md += "```text\n";
    for (const editor of stats.editors.slice(0, 5)) {
      md += `${formatLine(editor.name, editor.percent, editor.hours, editor.minutes)}\n`;
    }
    md += "```\n\n";
  }

  // Operating Systems
  if (stats.operating_systems && stats.operating_systems.length > 0) {
    md += "**🖥️ Operating Systems**\n\n";
    md += "```text\n";
    for (const os of stats.operating_systems) {
      md += `${formatLine(os.name, os.percent, os.hours, os.minutes)}\n`;
    }
    md += "```\n\n";
  }

  // All activities
  if (stats.categories && stats.categories.length > 0) {
    md += "**⚡ Activities**\n\n";
    md += "```text\n";
    for (const cat of stats.categories) {
      md += `${formatLine(cat.name, cat.percent, cat.hours, cat.minutes)}\n`;
    }
    md += "```\n\n";
  }

  return md;
}

async function main() {
  const readmePath = path.join(process.cwd(), "README.md");
  const readme = fs.readFileSync(readmePath, "utf-8");

  const [statsRes, insightsRes] = await Promise.all([
    wakaFetch("stats/last_7_days"),
    wakaFetch("insights/ai_days/last_7_days").catch(() => null),
  ]);

  const stats = statsRes.data;
  const insights = insightsRes ? insightsRes.data : null;
  const mdSection = renderMarkdown(stats, insights);

  const before = readme.split(START_MARK)[0];
  const after = readme.split(END_MARK)[1] || "";
  const newReadme = before + START_MARK + "\n" + mdSection + END_MARK + after;

  fs.writeFileSync(readmePath, newReadme, "utf-8");
  console.log("README updated successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
