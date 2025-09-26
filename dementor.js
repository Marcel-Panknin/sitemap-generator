const { execSync } = require('child_process');
const fs = require('fs');
const puppeteer = require('puppeteer');

class Dementor {
  constructor(options = {}) {
    this.targetUrl =
      options.targetUrl ||
      'https://www.tk.de/techniker/versicherung/tk-leistungen/weitere-leistungen-2078462';
    this.localPort = options.localPort || 3000;
    this.sitemapFile = options.sitemapFile || './dementor-sitemap.xml';
    this.tempHtmlFile = './temp-page.html';
    this.server = null;
    this.baseUrl = this.extractBaseUrl(this.targetUrl);
    this.currentLevel = 1;
    this.maxLevel = 3;
    this.minUrlsRequired = 3; // Minimum URLs needed to consider success

    // User-Agent Pool for rotation
    this.userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    this.currentUserAgent = this.getRandomUserAgent();
  }

  // Extract base URL from target URL
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

  // Get random user agent
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  // Generate random delay between requests (human-like timing)
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // LEVEL 1: Enhanced cURL with header rotation and timing
  async fetchWithEnhancedCurl() {
    console.log(`🌐 LEVEL 1: Enhanced cURL Attack...`);
    console.log(`🎯 Target: ${this.targetUrl}`);
    console.log(`🕵️ User-Agent: ${this.currentUserAgent}`);

    // Human-like delay before request
    await this.randomDelay(500, 1500);

    try {
      const acceptLanguages = [
        'de-DE,de;q=0.9,en;q=0.8',
        'en-US,en;q=0.9',
        'fr-FR,fr;q=0.9,en;q=0.8',
        'es-ES,es;q=0.9,en;q=0.8'
      ];

      const randomAcceptLanguage =
        acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];

      const curlCommand = [
        'curl',
        '-s',
        '-L',
        '-H',
        `"User-Agent: ${this.currentUserAgent}"`,
        '-H',
        '"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"',
        '-H',
        `"Accept-Language: ${randomAcceptLanguage}"`,
        '-H',
        '"Accept-Encoding: gzip, deflate, br"',
        '-H',
        '"DNT: 1"',
        '-H',
        '"Connection: keep-alive"',
        '-H',
        '"Upgrade-Insecure-Requests: 1"',
        '-H',
        '"Sec-Fetch-Dest: document"',
        '-H',
        '"Sec-Fetch-Mode: navigate"',
        '-H',
        '"Sec-Fetch-Site: none"',
        '-H',
        '"Cache-Control: max-age=0"',
        '--compressed',
        '--max-time',
        '30',
        '--connect-timeout',
        '10',
        '--retry',
        '3',
        '--retry-delay',
        '2',
        `"${this.targetUrl}"`
      ].join(' ');

      const html = execSync(curlCommand, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      if (html && html.length > 0) {
        console.log(`✅ Level 1 Success: ${html.length} bytes fetched`);
        return html;
      } else {
        throw new Error('Empty response from enhanced cURL');
      }
    } catch (error) {
      console.error(`❌ Level 1 Failed: ${error.message}`);
      throw error;
    }
  }

  // LEVEL 2: Puppeteer headless browser with JavaScript execution
  async fetchWithPuppeteer() {
    console.log(`🚀 LEVEL 2: Puppeteer Browser Attack...`);
    console.log(`🎯 Target: ${this.targetUrl}`);

    let browser = null;
    try {
      // Launch headless browser
      browser = await puppeteer.launch({
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

      const page = await browser.newPage();

      // Set realistic viewport
      await page.setViewport({ width: 1366, height: 768 });

      // Set user agent
      await page.setUserAgent(this.currentUserAgent);

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      console.log(`🌐 Loading page with JavaScript execution...`);

      // Navigate to page and wait for network to be idle
      await page.goto(this.targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for potential dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get the fully rendered HTML
      const html = await page.content();

      console.log(
        `✅ Level 2 Success: ${html.length} bytes fetched (with JavaScript)`
      );

      return html;
    } catch (error) {
      console.error(`❌ Level 2 Failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // LEVEL 3: Full stealth mode with anti-detection mechanisms
  async fetchWithStealthMode() {
    console.log(`🥷 LEVEL 3: Full Stealth Mode Attack...`);
    console.log(`🎯 Target: ${this.targetUrl}`);

    let browser = null;
    try {
      // Launch browser with stealth settings
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-features=TranslateUI',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--no-default-browser-check',
          '--no-first-run',
          '--password-store=basic',
          '--use-mock-keychain'
        ]
      });

      const page = await browser.newPage();

      // Advanced stealth techniques
      await page.evaluateOnNewDocument(() => {
        /* eslint-env browser */
        /* eslint-disable no-undef */
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['de-DE', 'de', 'en']
        });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = parameters =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
        /* eslint-enable no-undef */
      });

      // Set realistic viewport with random variation
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 }
      ];
      const randomViewport =
        viewports[Math.floor(Math.random() * viewports.length)];
      await page.setViewport(randomViewport);

      // Rotate user agent
      this.currentUserAgent = this.getRandomUserAgent();
      await page.setUserAgent(this.currentUserAgent);

      // Set comprehensive headers
      await page.setExtraHTTPHeaders({
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      });

      console.log(`🥷 Stealth navigation with human-like behavior...`);

      // Human-like delay before navigation
      await this.randomDelay(2000, 4000);

      // Navigate with stealth
      await page.goto(this.targetUrl, {
        waitUntil: 'networkidle0',
        timeout: 45000
      });

      // Simulate human behavior
      await this.randomDelay(1000, 3000);

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        /* eslint-env browser */
        window.scrollTo(0, document.body.scrollHeight / 4);
      });
      await this.randomDelay(1000, 2000);

      await page.evaluate(() => {
        /* eslint-env browser */
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.randomDelay(1000, 2000);

      await page.evaluate(() => {
        /* eslint-env browser */
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.randomDelay(2000, 4000);

      // Scroll back to top
      await page.evaluate(() => {
        /* eslint-env browser */
        window.scrollTo(0, 0);
      });
      await this.randomDelay(1000, 2000);

      // Wait for any additional dynamic content
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get the fully rendered HTML after all interactions
      const html = await page.content();

      console.log(
        `✅ Level 3 Success: ${html.length} bytes fetched (full stealth mode)`
      );

      return html;
    } catch (error) {
      console.error(`❌ Level 3 Failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Extract and validate URLs from HTML
  extractUrlsFromHtml(html) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    console.log(`🔍 Extracting URLs from HTML content...`);

    // Enhanced link discovery - find ALL possible link sources
    const linkSelectors = [
      'a[href]', // Standard links
      'link[href]', // Link tags
      '[data-href]', // Data href attributes
      '[data-url]', // Data URL attributes
      '[data-link]', // Data link attributes
      '[data-navigate]', // Custom navigation attributes
      'area[href]', // Image map areas
      'base[href]', // Base URLs
      'form[action]' // Form actions
    ];

    const discoveredLinks = new Set();

    linkSelectors.forEach(selector => {
      $(selector).each(function() {
        let href =
          $(this).attr('href') ||
          $(this).attr('data-href') ||
          $(this).attr('data-url') ||
          $(this).attr('data-link') ||
          $(this).attr('action');

        if (href) {
          discoveredLinks.add(href);
        }
      });
    });

    // Also look for URLs in JavaScript and JSON
    const self = this;
    $('script').each(function() {
      const scriptContent = $(this).html();
      if (scriptContent) {
        // Find URLs in JavaScript
        const urlMatches = scriptContent.match(/["']https?:\/\/[^"'\s]+["']/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            const cleanUrl = match.replace(/["']/g, '');
            if (cleanUrl.includes(self.baseUrl.replace(/https?:\/\//, ''))) {
              discoveredLinks.add(cleanUrl);
            }
          });
        }

        // Find relative URLs
        const relativeMatches = scriptContent.match(/["']\/[^"'\s]*["']/g);
        if (relativeMatches) {
          relativeMatches.forEach(match => {
            const cleanUrl = match.replace(/["']/g, '');
            if (cleanUrl.length > 1 && !cleanUrl.includes('//')) {
              discoveredLinks.add(self.baseUrl + cleanUrl);
            }
          });
        }
      }
    });

    // Process and validate URLs
    const validUrls = [];
    const baseUrlObj = new URL(this.baseUrl);

    discoveredLinks.forEach(href => {
      try {
        let processedUrl;

        // Skip certain protocols and invalid URLs
        if (
          !href ||
          href.trim() === '' ||
          /^(mailto:|tel:|javascript:|#|data:)/i.test(href)
        ) {
          return;
        }

        // Handle different URL formats
        if (href.startsWith('//')) {
          processedUrl = baseUrlObj.protocol + href;
        } else if (href.startsWith('/')) {
          processedUrl = this.baseUrl + href;
        } else if (href.startsWith('http')) {
          processedUrl = href;
        } else {
          // Relative URL
          processedUrl = new URL(href, this.baseUrl).href;
        }

        // Validate and filter URLs
        const urlObj = new URL(processedUrl);

        // Only include URLs from the same domain
        if (
          urlObj.hostname === baseUrlObj.hostname ||
          urlObj.hostname === 'www.' + baseUrlObj.hostname ||
          baseUrlObj.hostname === 'www.' + urlObj.hostname
        ) {
          // Remove fragments and clean up
          urlObj.hash = '';
          const cleanUrl = urlObj.href;

          // Avoid duplicates and common non-content URLs
          if (
            !validUrls.includes(cleanUrl) &&
            !cleanUrl.match(
              /\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip|exe)(\?|$)/i
            )
          ) {
            validUrls.push(cleanUrl);
          }
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });

    console.log(
      `🔗 Discovered ${discoveredLinks.size} raw links, validated ${
        validUrls.length
      } URLs`
    );
    return validUrls;
  }

  // Generate sitemap directly from extracted URLs
  async generateSitemap(html) {
    console.log(`🗺️ Generating sitemap from extracted URLs...`);

    try {
      // Extract URLs from HTML
      const urls = this.extractUrlsFromHtml(html);

      // Always include the base URL
      if (!urls.includes(this.targetUrl)) {
        urls.unshift(this.targetUrl);
      }

      // Generate XML sitemap
      const now = new Date().toISOString();
      let xmlContent = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n`;
      xmlContent += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      urls.forEach(url => {
        xmlContent += `  <url>\n`;
        xmlContent += `    <loc>${this.escapeXml(url)}</loc>\n`;
        xmlContent += `    <lastmod>${now}</lastmod>\n`;
        xmlContent += `    <changefreq>weekly</changefreq>\n`;
        xmlContent += `    <priority>0.8</priority>\n`;
        xmlContent += `  </url>\n`;
      });

      xmlContent += `</urlset>`;

      // Write sitemap to file
      fs.writeFileSync(this.sitemapFile, xmlContent, 'utf8');

      console.log(`✅ Sitemap generated: ${this.sitemapFile}`);
      console.log(`📊 Total URLs found: ${urls.length}`);

      // Log first few URLs for verification
      console.log(`🔗 Sample URLs:`);
      urls.slice(0, 5).forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
      if (urls.length > 5) {
        console.log(`   ... and ${urls.length - 5} more`);
      }

      return urls.length;
    } catch (error) {
      console.error(`❌ Sitemap generation failed: ${error.message}`);
      throw error;
    }
  }

  // Helper function to escape XML characters
  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function(c) {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
      }
    });
  }

  // Count URLs in sitemap
  countUrlsInSitemap() {
    try {
      if (!fs.existsSync(this.sitemapFile)) {
        return 0;
      }

      const content = fs.readFileSync(this.sitemapFile, 'utf8');
      const urlMatches = content.match(/<loc>/g);
      return urlMatches ? urlMatches.length : 0;
    } catch (error) {
      console.warn(`⚠️ Could not count URLs: ${error.message}`);
      return 0;
    }
  }

  // Cleanup
  async cleanup() {
    console.log(`🧹 Cleanup...`);

    try {
      if (fs.existsSync(this.tempHtmlFile)) {
        fs.unlinkSync(this.tempHtmlFile);
        console.log(`🗑️ Deleted cached HTML`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not delete cached HTML: ${error.message}`);
    }
  }

  // Main escalation method
  async run() {
    try {
      console.log(`🌑 DEMENTOR EVOLUTION - Escalating Attack System`);
      console.log(`🎯 Target: ${this.targetUrl}`);
      console.log(`📋 Strategy: Level 1 → Level 2 → Level 3 (until success)\n`);

      let html = null;

      // Try each level until success
      for (
        this.currentLevel = 1;
        this.currentLevel <= this.maxLevel;
        this.currentLevel++
      ) {
        try {
          console.log(`\n🌑 === ATTACK LEVEL ${this.currentLevel} ===`);

          // Fetch HTML based on current level
          switch (this.currentLevel) {
            case 1:
              html = await this.fetchWithEnhancedCurl();
              break;
            case 2:
              html = await this.fetchWithPuppeteer();
              break;
            case 3:
              html = await this.fetchWithStealthMode();
              break;
          }

          // Generate sitemap directly from HTML
          await this.generateSitemap(html);

          // Check if we have enough URLs
          const actualUrlCount = this.countUrlsInSitemap();
          console.log(
            `\n📊 Level ${
              this.currentLevel
            } Results: ${actualUrlCount} URLs extracted`
          );

          if (actualUrlCount >= this.minUrlsRequired) {
            console.log(
              `\n🎉 SUCCESS! Level ${
                this.currentLevel
              } extracted sufficient URLs (${actualUrlCount} >= ${
                this.minUrlsRequired
              })`
            );
            console.log(`🗺️ Sitemap saved to: ${this.sitemapFile}`);
            await this.cleanup();
            return;
          } else {
            console.log(
              `\n⚠️ Level ${
                this.currentLevel
              } insufficient: ${actualUrlCount} URLs < ${
                this.minUrlsRequired
              } required`
            );

            if (this.currentLevel < this.maxLevel) {
              console.log(`🔄 Escalating to Level ${this.currentLevel + 1}...`);
              await this.cleanup();
              await this.randomDelay(2000, 4000); // Delay between levels
            }
          }
        } catch (levelError) {
          console.error(
            `❌ Level ${this.currentLevel} failed: ${levelError.message}`
          );

          if (this.currentLevel < this.maxLevel) {
            console.log(
              `🔄 Escalating to Level ${this.currentLevel +
                1} due to failure...`
            );
            await this.cleanup();
            await this.randomDelay(2000, 4000);
          }
        }
      }

      // If all levels failed
      console.log(
        `\n💀 DEMENTOR DEFEATED: All ${
          this.maxLevel
        } levels failed to extract sufficient URLs`
      );
      console.log(
        `📊 Final result: ${this.countUrlsInSitemap()} URLs extracted`
      );
      console.log(`🛡️ Target has strong anti-bot protection`);

      await this.cleanup();
    } catch (error) {
      console.error(`❌ Critical Dementor error: ${error.message}`);
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
    '🌑 EVOLUTION - Eskalierendes Angriffssystem gegen Anti-Bot-Schutz 🌑'
  );
  console.log(
    '⚡ Level 1: Enhanced cURL → Level 2: Puppeteer → Level 3: Full Stealth ⚡'
  );
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
    console.log('🌑 DEMENTOR EVOLUTION - Interaktiver Modus\n');
    console.log('Der Dementor nutzt ein eskalierendes 3-Level-Angriffssystem:');
    console.log('📊 Level 1: Enhanced cURL mit Header-Rotation');
    console.log('🚀 Level 2: Puppeteer Browser mit JavaScript-Ausführung');
    console.log('🥷 Level 3: Full Stealth Mode mit Anti-Detection\n');
    console.log(
      'Das System eskaliert automatisch bis genügend URLs extrahiert wurden.\n'
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
      console.log('📋 Erwecke den Dementor Evolution...\n');

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
