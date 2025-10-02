/**
 * AOK Regional Sitemap Generator v2.0
 * 
 * Verwendet das zentrale aok-regions.js Modul
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getAOKRegions } = require('./aok-regions.js');

class AOKSitemapGenerator {
  constructor(options = {}) {
    this.baseUrl = 'https://www.aok.de/pk/leistungen/';
    this.outputDir = options.outputDir || './aok-sitemaps';
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // Lade Regionen aus zentralem Modul
    this.regionsManager = getAOKRegions();
    
    // Erstelle Output-Verzeichnis
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Extrahiert alle Links aus dem <ol> Element auf der Leistungsseite
   */
  async extractLinksFromPage(page) {
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

  /**
   * Setzt SessionStorage und navigiert zur Seite
   */
  async setRegionAndNavigate(page, regionData) {
    console.log(`\n🎯 Verarbeite Region: ${regionData.name} (${regionData.code})`);
    
    await page.goto(this.baseUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (regionData.code !== 'UNI') {
      await page.evaluate((code) => {
        sessionStorage.setItem('aoklv', code);
      }, regionData.code);
      
      console.log(`✅ SessionStorage gesetzt: aoklv = ${regionData.code}`);
      
      await page.setCookie({
        name: 'aok_location',
        value: regionData.code,
        domain: '.aok.de',
        path: '/',
        expires: Date.now() / 1000 + 365 * 24 * 60 * 60
      });
      
      console.log(`✅ Cookie gesetzt: aok_location = ${regionData.code}`);
      
      await page.reload({
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }

    await page.waitForTimeout(2000);
    
    const currentRegion = await page.evaluate(() => {
      return sessionStorage.getItem('aoklv');
    });
    
    console.log(`📍 Aktuelle Region im SessionStorage: ${currentRegion}`);
  }

  /**
   * Generiert Sitemap XML
   */
  generateSitemapXML(urls, regionData) {
    const now = new Date().toISOString();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    urls.forEach(url => {
      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    return xml;
  }

  /**
   * Generiert Sitemap für eine Region
   */
  async generateSitemapForRegion(browser, regionData, method = 'direct') {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1366, height: 768 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      await this.setRegionAndNavigate(page, regionData);
      
      const links = await this.extractLinksFromPage(page);
      console.log(`✅ ${links.length} Links gefunden für ${regionData.name}`);
      
      // Speichere mit erweiterten Metadaten
      const jsonData = {
        region: regionData.name,
        code: regionData.code,
        plz: regionData.plz,
        city: regionData.city,
        fullName: regionData.fullName,
        timestamp: new Date().toISOString(),
        count: links.length,
        links: links
      };
      
      const jsonFile = path.join(this.outputDir, `${regionData.code.toLowerCase()}-links.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
      console.log(`💾 JSON gespeichert: ${jsonFile}`);
      
      const sitemapXML = this.generateSitemapXML(links, regionData);
      const xmlFile = path.join(this.outputDir, `${regionData.code.toLowerCase()}-sitemap.xml`);
      fs.writeFileSync(xmlFile, sitemapXML);
      console.log(`💾 Sitemap gespeichert: ${xmlFile}`);
      
      return { region: regionData, links, success: true };
      
    } catch (error) {
      console.error(`❌ Fehler bei Region ${regionData.name}: ${error.message}`);
      return { region: regionData, links: [], success: false, error: error.message };
    } finally {
      await page.close();
    }
  }

  /**
   * Generiert Sitemaps für alle Regionen
   */
  async generateAllSitemaps(method = 'direct', includeUniversal = true) {
    console.log('🚀 AOK Regional Sitemap Generator v2.0 gestartet');
    console.log(`📁 Output-Verzeichnis: ${this.outputDir}`);
    console.log(`🔧 Methode: ${method === 'plz' ? 'PLZ-Eingabe' : 'Direkte SessionStorage-Manipulation'}`);
    
    // Hole Regionen aus dem Manager
    const regions = includeUniversal 
      ? this.regionsManager.getAllRegions()
      : this.regionsManager.getRegionsWithPLZ();
    
    console.log(`📊 Anzahl Regionen: ${regions.length}\n`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const results = [];
    
    try {
      for (const regionData of regions) {
        const result = await this.generateSitemapForRegion(browser, regionData, method);
        results.push(result);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      this.generateSummary(results);
      
    } finally {
      await browser.close();
    }
    
    console.log('\n✅ Alle Sitemaps generiert!');
    return results;
  }

  /**
   * Generiert Sitemaps nur für bestimmte Regionen (nach Code)
   */
  async generateForCodes(codes, method = 'direct') {
    console.log('🚀 AOK Regional Sitemap Generator v2.0');
    console.log(`🎯 Generiere Sitemaps für: ${codes.join(', ')}\n`);
    
    const regions = codes.map(code => this.regionsManager.getByCode(code)).filter(r => r !== undefined);
    
    if (regions.length === 0) {
      console.error('❌ Keine gültigen Regionscodes gefunden!');
      return [];
    }
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];
    
    try {
      for (const regionData of regions) {
        const result = await this.generateSitemapForRegion(browser, regionData, method);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      this.generateSummary(results);
      
    } finally {
      await browser.close();
    }
    
    return results;
  }

  /**
   * Erstellt eine Zusammenfassung aller generierten Sitemaps
   */
  generateSummary(results) {
    console.log('\n📊 ZUSAMMENFASSUNG\n');
    console.log('Region                      | Code | Links | Status');
    console.log('---------------------------------------------------');
    
    const summary = {
      timestamp: new Date().toISOString(),
      total_regions: results.length,
      successful: 0,
      failed: 0,
      regions: []
    };
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const linksCount = result.links.length.toString().padStart(5);
      const regionName = result.region.name.padEnd(25);
      
      console.log(`${regionName} | ${result.region.code}  | ${linksCount} | ${status}`);
      
      summary.regions.push({
        name: result.region.name,
        code: result.region.code,
        plz: result.region.plz,
        city: result.region.city,
        links_count: result.links.length,
        success: result.success,
        error: result.error || null
      });
      
      if (result.success) summary.successful++;
      else summary.failed++;
    });
    
    console.log('---------------------------------------------------');
    console.log(`Erfolgreich: ${summary.successful} | Fehlgeschlagen: ${summary.failed}`);
    
    const summaryFile = path.join(this.outputDir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Zusammenfassung gespeichert: ${summaryFile}`);
  }

  /**
   * Vergleicht die Sitemaps verschiedener Regionen
   */
  async compareSitemaps() {
    console.log('\n🔍 VERGLEICH DER REGIONALEN SITEMAPS\n');
    
    const allLinks = new Map();
    const regionLinks = new Map();
    
    const regions = this.regionsManager.getAllRegions();
    
    regions.forEach(regionData => {
      const jsonFile = path.join(this.outputDir, `${regionData.code.toLowerCase()}-links.json`);
      if (fs.existsSync(jsonFile)) {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        regionLinks.set(regionData.code, new Set(data.links));
        
        data.links.forEach(link => {
          if (!allLinks.has(link)) {
            allLinks.set(link, []);
          }
          allLinks.get(link).push(regionData.code);
        });
      }
    });
    
    const universalLinks = [];
    const regionalLinks = [];
    
    allLinks.forEach((codes, link) => {
      if (codes.length === regions.length) {
        universalLinks.push(link);
      } else {
        regionalLinks.push({ link, regions: codes });
      }
    });
    
    console.log(`📌 Universelle Links (in allen Regionen): ${universalLinks.length}`);
    console.log(`📍 Regionale Links (nur in bestimmten Regionen): ${regionalLinks.length}`);
    
    const comparisonFile = path.join(this.outputDir, 'comparison.json');
    fs.writeFileSync(comparisonFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      total_unique_links: allLinks.size,
      universal_links_count: universalLinks.length,
      regional_links_count: regionalLinks.length,
      universal_links: universalLinks,
      regional_links: regionalLinks.slice(0, 100)
    }, null, 2));
    
    console.log(`💾 Vergleich gespeichert: ${comparisonFile}`);
    
    console.log('\n📍 Beispiele für regionale Links:');
    regionalLinks.slice(0, 10).forEach(item => {
      console.log(`  ${item.link}`);
      console.log(`    → Verfügbar in: ${item.regions.join(', ')}\n`);
    });
  }
}

// CLI-Ausführung
if (require.main === module) {
  const generator = new AOKSitemapGenerator({
    outputDir: './aok-sitemaps'
  });
  
  const method = process.argv[2] || 'direct';
  const specificCodes = process.argv.slice(3);
  
  if (specificCodes.length > 0) {
    // Nur bestimmte Regionen
    console.log(`🎯 Generiere Sitemaps nur für: ${specificCodes.join(', ')}\n`);
    generator.generateForCodes(specificCodes, method)
      .then(() => {
        console.log('\n✅ Fertig!');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Fehler:', error);
        process.exit(1);
      });
  } else {
    // Alle Regionen
    generator.generateAllSitemaps(method)
      .then(() => {
        console.log('\n🔍 Erstelle Vergleich...');
        return generator.compareSitemaps();
      })
      .then(() => {
        console.log('\n✅ Fertig!');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Fehler:', error);
        process.exit(1);
      });
  }
}

module.exports = AOKSitemapGenerator;
