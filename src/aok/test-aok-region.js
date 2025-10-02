/**
 * Einfacher Test: SessionStorage und Cookie-Manipulation
 * 
 * Dieses Script demonstriert, wie man die AOK-Region setzt
 * und die unterschiedlichen Inhalte abruft.
 */

const puppeteer = require('puppeteer');

async function testRegionSwitching() {
  console.log('🧪 Test: AOK Region Switching\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Sichtbar für Demo
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Test 1: Universal (keine Region)
  console.log('📍 Test 1: Universal (keine Region)');
  await page.goto('https://www.aok.de/pk/leistungen/', {
    waitUntil: 'networkidle2'
  });
  
  let region = await page.evaluate(() => sessionStorage.getItem('aoklv'));
  console.log(`   SessionStorage aoklv: ${region}`);
  
  let links1 = await extractLinks(page);
  console.log(`   Gefundene Links: ${links1.length}\n`);
  
  await page.waitForTimeout(2000);

  // Test 2: Bayern
  console.log('📍 Test 2: Bayern (BAY)');
  await page.evaluate(() => {
    sessionStorage.setItem('aoklv', 'BAY');
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  
  region = await page.evaluate(() => sessionStorage.getItem('aoklv'));
  console.log(`   SessionStorage aoklv: ${region}`);
  
  let links2 = await extractLinks(page);
  console.log(`   Gefundene Links: ${links2.length}\n`);

  // Test 3: Baden-Württemberg
  console.log('📍 Test 3: Baden-Württemberg (BW)');
  await page.evaluate(() => {
    sessionStorage.setItem('aoklv', 'BW');
  });
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  
  region = await page.evaluate(() => sessionStorage.getItem('aoklv'));
  console.log(`   SessionStorage aoklv: ${region}`);
  
  let links3 = await extractLinks(page);
  console.log(`   Gefundene Links: ${links3.length}\n`);

  // Vergleich
  console.log('📊 VERGLEICH:');
  console.log(`   Universal: ${links1.length} Links`);
  console.log(`   Bayern:    ${links2.length} Links`);
  console.log(`   BW:        ${links3.length} Links\n`);

  // Finde Bayern-spezifische Links
  const bayernOnly = links2.filter(link => !links1.includes(link));
  console.log(`🎯 Bayern-spezifische Links: ${bayernOnly.length}`);
  if (bayernOnly.length > 0) {
    console.log('   Beispiele:');
    bayernOnly.slice(0, 5).forEach(link => {
      console.log(`   - ${link}`);
    });
  }

  console.log('\n✅ Test abgeschlossen!');
  console.log('💡 Tipp: Das Browser-Fenster bleibt offen. Drücke Ctrl+C zum Beenden.');
  
  // Browser offen lassen für Inspektion
  // await browser.close();
}

async function extractLinks(page) {
  return await page.evaluate(() => {
    const links = new Set();
    const olElements = document.querySelectorAll('ol');
    
    olElements.forEach(ol => {
      const anchors = ol.querySelectorAll('a[href]');
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const absoluteUrl = new URL(href, window.location.href).href;
            links.add(absoluteUrl);
          } catch (e) {
            // Ignoriere ungültige URLs
          }
        }
      });
    });
    
    return Array.from(links);
  });
}

// Ausführen
testRegionSwitching().catch(console.error);
