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

/**
 * Fetch WakaTime stats for the last 7 days.
 *
 * @see https://wakatime.com/developers#stats
 * @returns {Promise<Object>} The WakaTime stats.
 */
function fetchWakaStats() {
  const url = "https://wakatime.com/api/v1/users/current/stats/last_7_days";
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(WAKATIME_API_KEY).toString(
            "base64"
          )}`,
          "User-Agent": "github-action-waka-readme",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              resolve(json.data);
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

/**
 * Format the section for display.
 *
 * @param {*} name
 * @param {*} percent
 * @param {*} hours
 * @param {*} minutes
 * @returns {string} e.g. "JavaScript   1h 20m   ████░░░░ 50.00 %"
 */
function formatSec(name, percent, hours, minutes) {
  const timeText =
    typeof hours === "number" && typeof minutes === "number"
      ? `${hours}h ${minutes}m`
      : "";

  const barWidth = 24;
  const filled = Math.round((percent / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  const namePadded = name.padEnd(23, " ");
  const timePadded = timeText.padEnd(20, " ");
  const percentText = `${percent.toFixed(2)} %`;

  const middle = timePadded;

  return `${namePadded}${middle}${bar}   ${percentText}`;
}

/**
 * Render the WakaTime stats as Markdown.
 *
 * @param {*} stats
 * @returns {string} The rendered Markdown.
 */
function renderMarkdown(stats) {
  let content = "## WakaTime Stats (Last 7 Days)\n\n";

  content += "```text\n";
  var now = new Date();
  content += `Updated at : ${now.toTimeString()}\n`;

  content += `Data collection start: ${new Date(stats.start).toDateString()}\n`;

  content += "```\n\n";

  if (stats.languages && stats.languages.length > 0) {
    content += "### Languages\n\n";
    content += "```text\n";
    for (var i = 0; i < Math.min(5, stats.languages.length); i++) {
      var lang = stats.languages[i];
      content += `- ${formatSec(
        lang.name,
        lang.percent,
        lang.hours,
        lang.minutes
      )}\n`;
    }
    content += "```\n\n";
  }

  if (stats.operating_systems && stats.operating_systems.length > 0) {
    content += "### Operating Systems\n\n";
    content += "```text\n";
    for (const os of stats.operating_systems) {
      content += `- ${formatSec(os.name, os.percent, os.hours, os.minutes)}\n`;
    }
    content += "```\n\n";
  }

  if (stats.categories && stats.categories.length > 0) {
    content += "### Activities \n\n";
    content += "```text\n";
    for (const cat of stats.categories) {
      content += `- ${formatSec(
        cat.name,
        cat.percent,
        cat.hours,
        cat.minutes
      )}\n`;
    }
    content += "```\n\n";
  }

  return content;
}

/**
 * Main function to update the README.md file.
 */
async function main() {
  const readmePath = path.join(process.cwd(), "README.md");
  const readme = fs.readFileSync(readmePath, "utf-8");
  const stats = await fetchWakaStats();
  const mdSection = renderMarkdown(stats);

  const before = readme.split(START_MARK)[0];
  const after = readme.split(END_MARK)[1] || "";
  const newReadme = before + START_MARK + "\n" + mdSection + END_MARK + after;

  fs.writeFileSync(readmePath, newReadme, "utf-8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
