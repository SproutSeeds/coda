#!/usr/bin/env node
import lighthouse from "lighthouse";
import chromeLauncher from "chrome-launcher";

const url = process.env.LIGHTHOUSE_URL ?? "http://localhost:3000/dashboard/ideas";

async function run() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
    });

    const categories = runnerResult.lhr.categories;
    const scores = {
      performance: categories.performance.score * 100,
      accessibility: categories.accessibility.score * 100,
      bestPractices: categories["best-practices"].score * 100,
      seo: categories.seo.score * 100,
    };

    const thresholds = {
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 90,
    };

    const failures = Object.entries(scores).filter(
      ([key, value]) => value < thresholds[key],
    );

    if (failures.length > 0) {
      console.error("Lighthouse thresholds not met:");
      for (const [category, score] of failures) {
        console.error(`  ${category}: ${score}`);
      }
      process.exitCode = 1;
    } else {
      console.log("Lighthouse budgets satisfied", scores);
    }
  } catch (error) {
    console.error("Failed to run Lighthouse audit. Implement the UI before rerunning.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await chrome.kill();
  }
}

run();
