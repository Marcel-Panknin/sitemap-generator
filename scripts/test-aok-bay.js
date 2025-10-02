const fs = require('fs');
const path = require('path');
const Dementor = require('../dementor.js');

(async () => {
  try {
    const target = 'https://www.aok.de/pk/leistungen/';
    const dementor = new Dementor({ targetUrl: target });
    const sitemapDir = path.resolve('./sitemaps');
    const mdDir = path.resolve('./markdown-output/aok-bay-test');
    if (!fs.existsSync(sitemapDir)) fs.mkdirSync(sitemapDir, { recursive: true });
    if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });
    dementor.sitemapFile = path.join(sitemapDir, 'aok-bay-test.xml');
    dementor.markdownOutputDir = mdDir;

    console.log('▶️ Running AOK BAY regional extraction on', target);
    const mockHtml = await dementor.fetchWithAOKRegion('BAY');
    await dementor.generateSitemap(mockHtml);
    const count = dementor.countUrlsInSitemap();
    console.log('✅ Extracted URLs:', count);
    if (count >= dementor.minUrlsRequired) {
      const ok = await dementor.convertSitemapToMarkdown();
      console.log('📝 Markdown conversion:', ok);
    } else {
      console.log('⚠️ Not enough URLs extracted for markdown conversion');
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
})();