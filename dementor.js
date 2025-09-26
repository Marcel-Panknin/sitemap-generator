const SitemapGenerator = require('sitemap-generator');
const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

class Dementor {
  constructor(options = {}) {
    this.targetUrl =
      options.targetUrl ||
      'https://www.tk.de/techniker/versicherung/tk-leistungen/weitere-leistungen-2078462';
    this.localPort = options.localPort || 3000;
    this.userAgent =
      options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.sitemapFile = options.sitemapFile || './dementor-sitemap.xml';
    this.tempHtmlFile = './temp-page.html';
    this.server = null;
    this.baseUrl = this.extractBaseUrl(this.targetUrl);
  }

  // Extract base URL from target URL (e.g., https://www.tk.de/)
  extractBaseUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}/`;
    } catch (error) {
      console.warn(
        `⚠️ Could not extract base URL from ${url}: ${error.message}`
      );
      return url;
    }
  }

  // Step 1: cURL-Anfrage an beliebige URL
  async fetchWithCurl() {
    console.log(`🌐 Step 1: Fetching URL with cURL...`);
    console.log(`🎯 Target: ${this.targetUrl}`);

    try {
      const curlCommand = [
        'curl',
        '-s',
        '-L',
        '-H',
        `"User-Agent: ${this.userAgent}"`,
        '-H',
        '"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"',
        '-H',
        '"Accept-Language: de-DE,de;q=0.9,en;q=0.8"',
        '-H',
        '"Accept-Encoding: gzip, deflate"',
        '-H',
        '"DNT: 1"',
        '-H',
        '"Connection: keep-alive"',
        '--compressed',
        '--max-time',
        '30',
        `"${this.targetUrl}"`
      ].join(' ');

      const html = execSync(curlCommand, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      if (html && html.length > 0) {
        console.log(`✅ Successfully fetched ${html.length} bytes`);
        return html;
      } else {
        throw new Error('Empty response from cURL');
      }
    } catch (error) {
      console.error(`❌ cURL failed: ${error.message}`);
      throw error;
    }
  }

  // Step 2: Empfangenes HTML zwischenspeichern
  async cacheHtml(html) {
    console.log(`💾 Step 2: Caching HTML locally...`);

    try {
      fs.writeFileSync(this.tempHtmlFile, html);
      console.log(`✅ HTML cached to: ${this.tempHtmlFile}`);
      return this.tempHtmlFile;
    } catch (error) {
      console.error(`❌ Failed to cache HTML: ${error.message}`);
      throw error;
    }
  }

  // Step 3: HTML kurzzeitig lokal zur Verfügung stellen (localhost:3000)
  async startLocalServer() {
    console.log(
      `🚀 Step 3: Starting local server on localhost:${this.localPort}...`
    );

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        try {
          // Serve the cached HTML file for any request
          if (fs.existsSync(this.tempHtmlFile)) {
            const html = fs.readFileSync(this.tempHtmlFile, 'utf8');
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(html);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('HTML file not found');
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server error');
        }
      });

      this.server.listen(this.localPort, err => {
        if (err) {
          reject(err);
        } else {
          console.log(
            `✅ Local server running on http://localhost:${this.localPort}`
          );
          resolve();
        }
      });
    });
  }

  // Custom discoverResources function that finds ALL href attributes
  createCustomDiscoverResources() {
    const url = require('url');
    const cheerio = require('cheerio');

    return (buffer, queueItem) => {
      const $ = cheerio.load(buffer.toString('utf8'));

      const metaRobots = $('meta[name="robots"]');
      if (metaRobots.length && /nofollow/i.test(metaRobots.attr('content'))) {
        return [];
      }

      // Find ALL elements with href attributes, not just <a> tags
      const links = $('[href]').map(function iteratee() {
        let href = $(this).attr('href');
        const tagName = this.tagName.toLowerCase();

        // Skip certain tag types that shouldn't be crawled
        if (['link', 'base'].includes(tagName)) {
          // Skip CSS, favicon, and other non-HTML resources
          const rel = $(this).attr('rel');
          if (
            rel &&
            /stylesheet|icon|preload|prefetch|dns-prefetch|preconnect/i.test(
              rel
            )
          ) {
            return null;
          }
        }

        // exclude "mailto:", "tel:", "javascript:" etc
        if (/^[a-z]+:(?!\/\/)/i.test(href)) {
          return null;
        }

        // exclude rel="nofollow" links (mainly for <a> tags)
        const rel = $(this).attr('rel');
        if (/nofollow/i.test(rel)) {
          return null;
        }

        // remove anchors
        href = href.replace(/(#.*)$/, '');

        // remove basic authentication
        href = href.replace(/^\/?([^/]*@)/, '');

        // Skip empty hrefs
        if (!href || href.trim() === '') {
          return null;
        }

        // handle "//"
        if (/^\/\//.test(href)) {
          return `${queueItem.protocol}:${href}`;
        }

        // check if link is relative
        if (!/^https?:\/\//.test(href)) {
          const base = $('base').first();
          if (base.length && base.attr('href') !== undefined) {
            href = url.resolve(base.attr('href'), href);
          }

          // handle links such as "./foo", "../foo", "/foo"
          if (/^\.\.?\/.*/.test(href) || /^\/[^/].*/.test(href)) {
            href = url.resolve(queueItem.url, href);
          }
        }

        return href;
      });

      const uniqueLinks = [
        ...new Set(links.get().filter(link => link !== null))
      ];
      console.log(
        `🔗 Found ${uniqueLinks.length} unique href attributes in HTML`
      );
      return uniqueLinks;
    };
  }

  // Step 4: Crawler auf localhost:3000 senden und Sitemap erstellen
  async generateSitemap() {
    console.log(
      `🗺️ Step 4: Generating sitemap from localhost:${this.localPort}...`
    );

    return new Promise((resolve, reject) => {
      const localUrl = `http://localhost:${this.localPort}`;

      const generator = SitemapGenerator(localUrl, {
        stripQuerystring: false,
        filepath: this.sitemapFile,
        maxDepth: 3,
        maxEntriesPerFile: 50000,
        userAgent: this.userAgent,
        interval: 500,
        maxConcurrency: 1
      });

      // Get the crawler and set our custom discoverResources function
      const crawler = generator.getCrawler();
      crawler.discoverResources = this.createCustomDiscoverResources();

      let urlCount = 0;

      generator.on('done', () => {
        console.log(`✅ Sitemap generated: ${this.sitemapFile}`);
        console.log(`📊 Total URLs found: ${urlCount}`);
        resolve();
      });

      generator.on('error', error => {
        console.error(`❌ Sitemap generation failed: ${error.message}`);
        reject(error);
      });

      generator.on('add', url => {
        urlCount++;
        console.log(`📝 Added to sitemap [${urlCount}]: ${url}`);
      });

      generator.on('fetch', (status, url) => {
        console.log(`🔍 Fetching: ${url} (${status})`);
      });

      // Start the crawler
      console.log(`🚀 Starting sitemap generator on ${localUrl}...`);
      console.log(
        `🔧 Using enhanced href discovery (all HTML elements with href attributes)`
      );
      generator.start();
    });
  }

  // Step 4.5: Post-process sitemap to replace localhost URLs with real URLs
  async postProcessSitemap() {
    console.log(
      `🔄 Step 4.5: Post-processing sitemap - replacing localhost URLs...`
    );

    try {
      if (!fs.existsSync(this.sitemapFile)) {
        throw new Error(`Sitemap file not found: ${this.sitemapFile}`);
      }

      // Read the sitemap content
      let sitemapContent = fs.readFileSync(this.sitemapFile, 'utf8');

      // Replace localhost URLs with real URLs
      const localhostPattern = new RegExp(
        `http://localhost:${this.localPort}/`,
        'g'
      );
      const updatedContent = sitemapContent.replace(
        localhostPattern,
        this.baseUrl
      );

      // Count replacements for logging
      const matches = sitemapContent.match(localhostPattern);
      const replacementCount = matches ? matches.length : 0;

      // Write the updated content back to the file
      fs.writeFileSync(this.sitemapFile, updatedContent);

      console.log(
        `✅ Sitemap post-processed: ${replacementCount} localhost URLs replaced with ${
          this.baseUrl
        }`
      );
    } catch (error) {
      console.error(`❌ Sitemap post-processing failed: ${error.message}`);
      throw error;
    }
  }

  // Step 5: localhost:3000 wieder beenden und HTML löschen
  async cleanup() {
    console.log(
      `🧹 Step 5: Cleanup - stopping server and deleting cached HTML...`
    );

    // Stop server
    if (this.server) {
      this.server.close();
      console.log(`🛑 Local server stopped`);
    }

    // Delete cached HTML file
    try {
      if (fs.existsSync(this.tempHtmlFile)) {
        fs.unlinkSync(this.tempHtmlFile);
        console.log(`🗑️ Deleted cached HTML: ${this.tempHtmlFile}`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not delete cached HTML: ${error.message}`);
    }

    console.log(`✅ Cleanup completed`);
  }

  // Hauptmethode: Führt alle Schritte sequenziell aus
  async run() {
    try {
      console.log(`🌑 Awakening the Dementor...`);
      console.log(
        `📋 Soul Extraction Protocol: cURL -> cache -> serve -> crawl -> post-process -> cleanup\n`
      );

      // Step 1: cURL-Anfrage
      const html = await this.fetchWithCurl();

      // Step 2: HTML zwischenspeichern
      await this.cacheHtml(html);

      // Step 3: Lokalen Server starten
      await this.startLocalServer();

      // Kurz warten, damit der Server bereit ist
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Sitemap generieren
      await this.generateSitemap();

      // Step 4.5: Sitemap nachbearbeiten (localhost URLs ersetzen)
      await this.postProcessSitemap();

      // Step 5: Cleanup
      await this.cleanup();

      console.log(`\n🎉 The Dementor has consumed all souls!`);
      console.log(`🗺️ Web essence extracted to: ${this.sitemapFile}`);
    } catch (error) {
      console.error(`❌ The Dementor encountered resistance: ${error.message}`);

      await this.cleanup();

      throw error;
    }
  }
}

// Display epic ASCII banner
function displayBanner() {
  console.log('\n');
  console.log(
    '██████╗ ███████╗███╗   ███╗███████╗███╗   ██╗████████╗ ██████╗ ██████╗ '
  );
  console.log(
    '██╔══██╗██╔════╝████╗ ████║██╔════╝████╗  ██║╚══██╔══╝██╔═══██╗██╔══██╗'
  );
  console.log(
    '██║  ██║█████╗  ██╔████╔██║█████╗  ██╔██╗ ██║   ██║   ██║   ██║██████╔╝'
  );
  console.log(
    '██║  ██║██╔══╝  ██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║   ██║   ██║██╔══██╗'
  );
  console.log(
    '██████╔╝███████╗██║ ╚═╝ ██║███████╗██║ ╚████║   ██║   ╚██████╔╝██║  ██║'
  );
  console.log(
    '╚═════╝ ╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝'
  );
  console.log('\n');
  console.log(
    '🌑 Der dunkle Wächter des Webs - Saugt alle URLs aus jeder Seite 🌑'
  );
  console.log('⚡ Kein Link kann vor dem Dementor verborgen bleiben ⚡');
  console.log(
    '🕷️ Durchdringt das Web und extrahiert jede Spur von Hyperlinks 🕷️'
  );
  console.log('\n');
}

// Interactive prompt function
async function promptForUrl() {
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    displayBanner();
    console.log('🌑 DEMENTOR - Interaktiver Modus\n');
    console.log('Der Dementor saugt alle URLs aus jeder beliebigen Webseite.');
    console.log(
      'Er durchdringt das Web und extrahiert jeden versteckten Hyperlink.\n'
    );

    rl.question(
      '🌐 Bitte geben Sie die Ziel-URL ein (z.B. https://example.com): ',
      answer => {
        rl.close();

        // Validate URL
        if (!answer || answer.trim() === '') {
          console.log('❌ Keine URL eingegeben. Verwende Standard-URL...');
          resolve(
            'https://www.tk.de/techniker/versicherung/tk-leistungen/weitere-leistungen-2078462'
          );
        } else {
          const url = answer.trim();

          // Add https:// if no protocol is specified
          if (!/^https?:\/\//i.test(url)) {
            const correctedUrl = `https://${url}`;
            console.log(`🔧 Protokoll hinzugefügt: ${correctedUrl}`);
            resolve(correctedUrl);
          } else {
            resolve(url);
          }
        }
      }
    );
  });
}

// Run if called directly
if (require.main === module) {
  (async () => {
    try {
      const targetUrl = await promptForUrl();

      console.log(`\n🎯 Ziel-URL: ${targetUrl}`);
      console.log('📋 Erwecke den Dementor...\n');

      const dementor = new Dementor({
        targetUrl: targetUrl,
        localPort: 3000,
        sitemapFile: './dementor-sitemap.xml'
      });

      await dementor.run();
    } catch (error) {
      console.error('❌ Fehler beim Erwecken des Dementors:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = Dementor;
