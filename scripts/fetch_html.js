#!/usr/bin/env node
/**
 * Fetch HTML via Puppeteer and print to stdout.
 * Usage: node scripts/fetch_html.js <url>
 */
const puppeteer = require('puppeteer');

async function run() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/fetch_html.js <url>');
    process.exit(2);
  }
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800'
      ]
    });
    const page = await browser.newPage();
    // Modest stealth headers
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
    });
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate and wait for network idle
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Give client-side rendering a bit of time
    await page.waitForTimeout(1000);

    const html = await page.content();
    process.stdout.write(html);
    process.exit(0);
  } catch (err) {
    console.error(err?.message || String(err));
    process.exit(1);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

run();