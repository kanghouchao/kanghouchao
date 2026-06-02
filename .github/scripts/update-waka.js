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

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
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

function renderMarkdown(stats) {
  const now = new Date();
  let md = "";

  md += `**📊 Weekly Development Breakdown** · \`${formatJST(now)}\`\n\n`;

  // Agents (AI tools like Claude Code, Cursor, Copilot, etc.)
  if (stats.agents && stats.agents.length > 0) {
    md += "**🤖 Agents**\n\n";
    md += "```text\n";
    for (const agent of stats.agents.slice(0, 8)) {
      md += `${formatLine(agent.name, agent.percent, agent.hours, agent.minutes)}\n`;
    }
    md += "```\n\n";
  }

  // AI Tokens
  const inputTokens = stats.ai_input_tokens || 0;
  const outputTokens = stats.ai_output_tokens || 0;
  if (inputTokens > 0 || outputTokens > 0) {
    const totalTokens = inputTokens + outputTokens;
    md += "**🔤 AI Tokens**\n\n";
    md += "```text\n";
    md += `Input Tokens         ${formatNumber(inputTokens).padEnd(12)}${formatBar(totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0)}\n`;
    md += `Output Tokens        ${formatNumber(outputTokens).padEnd(12)}${formatBar(totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0)}\n`;
    md += `Total                ${formatNumber(totalTokens)}\n`;
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

  // Activities
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

  const statsRes = await wakaFetch("stats/last_7_days");
  const stats = statsRes.data;

  // Log available top-level keys for debugging
  console.log("Stats keys:", Object.keys(stats).join(", "));
  if (stats.agents) console.log("Agents found:", stats.agents.length);
  if (stats.ai_input_tokens != null) console.log("AI input tokens:", stats.ai_input_tokens);
  if (stats.ai_output_tokens != null) console.log("AI output tokens:", stats.ai_output_tokens);

  const mdSection = renderMarkdown(stats);

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
