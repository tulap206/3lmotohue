const { execSync } = require("child_process");

const PROJECTS = [
  "pc02app",
  "ptthue",
  "quy79",
  "quangvinh",
  "lap68",
  "camera247hue4",
];

const KEEP_RECENT = 3;
const BATCH_SIZE = 25;

function fetchAllDeployments(project) {
  let all = [];
  let next = null;
  while (true) {
    const cmd = `vercel ls ${project} --limit 100 --json ${next ? `--next ${next}` : ""}`;
    try {
      const raw = execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] }).toString();
      const data = JSON.parse(raw);
      const deps = data.deployments || [];
      all.push(...deps);
      if (!data.pagination?.next || deps.length === 0) break;
      next = data.pagination.next;
    } catch (e) {
      console.error(`Error fetching deployments for ${project}:`, e.message);
      break;
    }
  }
  return all;
}

function removeBatch(urls) {
  if (urls.length === 0) return 0;
  const cmd = `vercel remove ${urls.join(" ")} --yes --safe`;
  try {
    execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] });
    return urls.length;
  } catch (e) {
    console.error(`Error removing batch:`, e.message);
    return 0;
  }
}

async function main() {
  console.log("=== Starting Vercel Old Deployments Cleanup ===");
  let totalDeleted = 0;

  for (const project of PROJECTS) {
    console.log(`\nScanning project [${project}]...`);
    const deployments = fetchAllDeployments(project);
    console.log(`Found ${deployments.length} deployments for ${project}.`);

    if (deployments.length <= KEEP_RECENT) {
      console.log(`Project ${project} has <= ${KEEP_RECENT} deployments. Keeping all.`);
      continue;
    }

    // Keep the newest KEEP_RECENT deployments
    const toDelete = deployments.slice(KEEP_RECENT);
    console.log(`Keeping ${KEEP_RECENT} newest. Deleting ${toDelete.length} old deployments...`);

    const urls = toDelete.map((d) => d.url).filter(Boolean);
    let projectDeleted = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const chunk = urls.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  Removing ${i + 1} - ${Math.min(i + BATCH_SIZE, urls.length)} / ${urls.length}... `);
      const removed = removeBatch(chunk);
      projectDeleted += removed;
      console.log(`Done.`);
    }

    console.log(`Completed ${project}: removed ${projectDeleted} deployments.`);
    totalDeleted += projectDeleted;
  }

  console.log(`\n🎉 All done! Total deployments removed across all projects: ${totalDeleted}`);
}

main().catch(console.error);
