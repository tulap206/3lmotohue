const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const versionFilePath = path.join(__dirname, "..", "lib", "version.json")

function getGitCommitCount() {
  try {
    const output = execSync("git rev-list --count HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    const count = parseInt(output.trim(), 10)
    return isNaN(count) ? null : count
  } catch {
    return null
  }
}

function bumpVersion() {
  let versionData = {
    major: 2,
    minor: 0,
    patch: 0,
    version: "2.0.0",
    baseCommitCount: 468,
    author: "@TuLap",
    phone: "0967611112",
    displayBrand: "3LMoto",
    lastUpdated: new Date().toISOString()
  }

  if (fs.existsSync(versionFilePath)) {
    try {
      const raw = fs.readFileSync(versionFilePath, "utf8")
      versionData = { ...versionData, ...JSON.parse(raw) }
    } catch (e) {
      console.warn("Could not parse existing version.json, using defaults:", e.message)
    }
  }

  const commitCount = getGitCommitCount()
  const baseCount = versionData.baseCommitCount || 468

  if (commitCount !== null && commitCount >= baseCount) {
    versionData.patch = commitCount - baseCount
  } else {
    versionData.patch = (typeof versionData.patch === "number" ? versionData.patch : 0) + 1
  }

  versionData.version = `${versionData.major}.${versionData.minor}.${versionData.patch}`
  versionData.lastUpdated = new Date().toISOString()

  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + "\n", "utf8")
  console.log(`[Version Auto-Bump] Updated to v${versionData.version} (Commit count: ${commitCount ?? "N/A"})`)
}

bumpVersion()
