const fs = require("fs");
const path = require("path");
const https = require("https");

function fetchWaka(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "wakatime.com",
      path: "/api/v1/users/current/stats/last_7_days",
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ":api_token").toString(
          "base64"
        )}`,
        "User-Agent": "github-action-waka-readme",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function secondsToText(seconds) {
  if (!seconds || isNaN(seconds)) return "0 secs";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (hrs) parts.push(`${hrs} hrs`);
  if (mins) parts.push(`${mins} mins`);
  if (!parts.length) parts.push("0 secs");
  return parts.join(" ");
}

function makeBar(percent, width = 25) {
  const filled = Math.round((percent / 100) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

function formatDate(d) {
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function makeBlock(stats) {
  const languages = Array.isArray(stats.data) ? stats.data : [];
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 6); // last 7 days

  const totalSeconds =
    stats.total_seconds ||
    languages.reduce((s, l) => s + (l.total_seconds || 0), 0);

  const lines = [];
  lines.push("```txt");
  lines.push(`From: ${formatDate(from)} - To: ${formatDate(now)}`);
  lines.push("");
  lines.push(`Total Time: ${secondsToText(totalSeconds)}`);
  lines.push("");

  const top = languages.slice(0, 8);
  top.forEach((lang) => {
    const name = (lang.name || "").padEnd(25, " ");
    const time = lang.text || secondsToText(lang.total_seconds);
    const percent =
      typeof lang.percent === "number"
        ? lang.percent
        : totalSeconds
        ? ((lang.total_seconds || 0) / totalSeconds) * 100
        : 0;
    const bar = makeBar(percent, 25);
    lines.push(
      `${name} ${time.padEnd(15, " ")} ${bar}   ${percent.toFixed(2)} %`
    );
  });

  lines.push("```");
  return lines.join("\n");
}

async function run() {
  const apiKey = process.env.WAKATIME_API_KEY;
  if (!apiKey) {
    console.error("Missing WAKATIME_API_KEY");
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const readmePath = path.join(repoRoot, "README.md");
  if (!fs.existsSync(readmePath)) {
    console.error("README.md not found at", readmePath);
    process.exit(1);
  }

  console.log("Fetching WakaTime stats...");
  const res = await fetchWaka(apiKey);

  if (!res || !res.data) {
    console.error("Unexpected response from WakaTime", res);
    process.exit(1);
  }

  const block = makeBlock(res);

  const readme = fs.readFileSync(readmePath, "utf8");
  const startTag = "<!--START_SECTION:waka-->";
  const endTag = "<!--END_SECTION:waka-->";

  const start = readme.indexOf(startTag);
  const end = readme.indexOf(endTag);
  if (start === -1 || end === -1) {
    console.error("Waka section tags not found in README.md");
    process.exit(1);
  }

  const newReadme =
    readme.slice(0, start + startTag.length) +
    "\n\n" +
    block +
    "\n\n" +
    readme.slice(end);
  fs.writeFileSync(readmePath, newReadme, "utf8");
  console.log("README.md updated");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
