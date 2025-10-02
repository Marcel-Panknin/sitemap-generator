const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
// Optional AOK regions support
let getAOKRegions;
try {
  ({ getAOKRegions } = require('./src/aok/aok-regions.js'));
} catch (e) {
  // AOK regions module not available; AOK flow will be skipped
}

class Dementor {
  constructor(options = {}) {
    this.targetUrl =
      options.targetUrl ||
      'https://www.aok.de/pk/leistungen/';
    this.localPort = options.localPort || 3000;
    this.sitemapFile = options.sitemapFile || './dementor-sitemap.xml';
    this.markdownOutputDir = options.markdownOutputDir || './markdown-output';
    this.tempHtmlFile = './temp-page.html';
    this.server = null;
    this.baseUrl = this.extractBaseUrl(this.targetUrl);
    this.currentLevel = 0; // Start mit Level 0 (SitemapGenerator)
    this.maxLevel = 3; // Jetzt 4 Level insgesamt (0, 1, 2, 3)
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

    // Supabase related
    this.supabaseClient = null;
    this.selectorHtmlTarget = null;
    // AOK regions manager
    this.aokRegions = getAOKRegions ? getAOKRegions() : null;
  }

  // Initialize Supabase client from environment variables
  initSupabaseClient() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.log('ℹ️ Supabase environment variables not found. Skipping Supabase mode.');
        return false;
      }
      const { createClient } = require('@supabase/supabase-js');
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to initialize Supabase client: ${error.message}`);
      return false;
    }
  }

  // Fetch insurers from Supabase
  async fetchInsurersFromSupabase() {
    if (!this.supabaseClient) return [];
    const tableName = process.env.SUPABASE_TABLE || 'statutory_health_insurer';
    console.log(`📦 Fetching insurers from table: ${tableName}`);

    const { data, error } = await this.supabaseClient
      .from(tableName)
      .select('name, leistungen_url, html_target')
      .not('leistungen_url', 'is', null)
      .not('html_target', 'is', null);

    if (error) {
      console.error(`❌ Supabase query failed: ${error.message}`);
      return [];
    }

    console.log(`✅ Retrieved ${data.length} insurers from Supabase`);
    return data;
  }

  // Detect AOK insurer and infer region
  detectAOKRegion(row) {
    const rawName = (row.name || '').trim();
    const urlStr = (row.leistungen_url || '').trim();
    let hostIsAOK = false;
    try {
      const u = new URL(urlStr);
      hostIsAOK = /(^|\.)aok\.de$/i.test(u.hostname);
    } catch (_) {
      hostIsAOK = false;
    }

    const isAOKByName = /(^|\b)AOK\b/i.test(rawName);
    const isAOK = (isAOKByName || hostIsAOK);
    if (!isAOK || !this.aokRegions) return { isAOK: false };

    let region = null;

    // First try direct match against config fullName/name
    region = this.aokRegions.getByName(rawName) || null;

    // Heuristic: derive region name from rawName by stripping prefixes/suffixes
    if (!region && isAOKByName) {
      let derived = rawName.replace(/^\s*AOK\s*/i, '')
        .replace(/^[-–—]+\s*/i, '')
        .replace(/-\s*die\s+gesundheitskasse.*$/i, '')
        .replace(/^die\s+gesundheitskasse\s+für\s+/i, '')
        .trim();
      if (derived) {
        region = this.aokRegions.getByName(derived) || null;
      }
    }

    // Fallback: infer by URL slug after /pk/
    if (!region && urlStr) {
      try {
        const u = new URL(urlStr);
        const parts = (u.pathname || '').split('/').filter(Boolean);
        const slug = parts.length >= 2 ? parts[1] : null; // '/pk/<slug>/'
        if (slug) {
          const all = this.aokRegions.getAllRegions();
          const match = all.find(r => {
            if (!r || !r.website) return false;
            try {
              const wu = new URL(r.website.endsWith('/') ? r.website : r.website + '/');
              const wparts = (wu.pathname || '').split('/').filter(Boolean);
              const wslug = wparts.length >= 2 ? wparts[1] : null;
              return wslug && wslug.toLowerCase() === slug.toLowerCase();
            } catch (_) {
              return false;
            }
          });
          if (match) region = match;
        }
      } catch (_) {}
    }

    const code = region?.code || 'UNI';
    return { isAOK: true, code, region };
  }

  // Slugify name for filenames/directories
  slugifyName(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  // Fetch a page and extract only links within the html_target selector
  async fetchLinksFromHtmlTarget(url, selector) {
    console.log(`📚 LEVEL 0: Supabase-targeted extraction`);
    console.log(`🎯 Page: ${url}`);
    console.log(`🎯 Selector: ${selector}`);

    // Human-like delay
    await this.randomDelay(400, 1200);

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
        '--compressed',
        '--max-time',
        '30',
        '--connect-timeout',
        '10',
        '--retry',
        '3',
        '--retry-delay',
        '2',
        `"${url}"`
      ].join(' ');

      const html = execSync(curlCommand, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      if (!html || html.length === 0) {
        throw new Error('Empty response from target page');
      }

      // Parse and extract only links inside the target selector
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      
      // Normalize html_target if it is an HTML fragment into a CSS selector
      let cssSelector = selector;
      try {
        if (typeof selector === 'string' && selector.trim().startsWith('<')) {
          // First try regex-based extraction for incomplete fragments
          const tagMatch = selector.match(/<\s*([a-zA-Z0-9_-]+)/);
          const idMatch = selector.match(/id=["']([^"']+)["']/i);
          const classMatch = selector.match(/class=["']([^"']+)["']/i);
          if (tagMatch) {
            const tag = tagMatch[1].toLowerCase();
            const classes = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [];
            cssSelector = tag + (idMatch ? `#${idMatch[1]}` : '') + (classes.length ? `.${classes.join('.')}` : '');
          } else {
            // Fallback to cheerio parsing
            const fragment$ = cheerio.load(selector.trim());
            const el = fragment$('*').first();
            const tag = (el.get(0) && el.get(0).tagName) ? el.get(0).tagName.toLowerCase() : 'div';
            const idAttr = el.attr('id');
            const classAttr = el.attr('class');
            const classes = classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
            cssSelector = tag + (idAttr ? `#${idAttr}` : '') + (classes.length ? `.${classes.join('.')}` : '');
          }
          // Avoid selecting entire document accidentally
          if (cssSelector === 'html') {
            const tagOnly = (tagMatch && tagMatch[1]) ? tagMatch[1].toLowerCase() : 'div';
            cssSelector = tagOnly;
          }
          console.log(`🔧 Normalized selector: ${cssSelector}`);
        }
      } catch (selErr) {
        console.log(`⚠️ Selector normalization failed, using raw selector: ${selector}`);
        cssSelector = selector;
      }

      const baseUrl = this.extractBaseUrl(url);
      const linksSet = new Set();

      // Multiple matches allowed; aggregate all descendant links
      const containers = $(cssSelector);
      if (containers.length === 0) {
        console.log('⚠️ Selector did not match any elements on the page.');
      }

      containers.each((idx, el) => {
        $(el)
          .find('a[href]')
          .each((i, a) => {
            const href = $(a).attr('href');
            if (!href) return;

            // Ignore fragment/mail/tel
            if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
              return;
            }

            let absoluteUrl;
            if (/^https?:\/\//i.test(href)) {
              absoluteUrl = href;
            } else if (href.startsWith('//')) {
              const baseObj = new URL(baseUrl);
              absoluteUrl = `${baseObj.protocol}${href}`;
            } else if (href.startsWith('/')) {
              absoluteUrl = baseUrl.replace(/\/$/, '') + href;
            } else {
              absoluteUrl = baseUrl.replace(/\/$/, '') + '/' + href;
            }

            linksSet.add(absoluteUrl);
          });
      });

      const links = Array.from(linksSet);
      console.log(`✅ Level 0 (selector-based) extracted ${links.length} links`);

      // Build mock HTML of only the selected links
      return this.generateMockHtmlFromUrls(links);
    } catch (error) {
      console.error(`❌ Level 0 selector-based extraction failed: ${error.message}`);
      throw error;
    }
  }

  // LEVEL 0: SitemapGenerator (Standard Library Approach)
  async fetchWithSitemapGenerator() {
    console.log(`📚 LEVEL 0: SitemapGenerator Library Attack...`);
    console.log(`🎯 Target: ${this.targetUrl}`);

    return new Promise((resolve, reject) => {
      try {
        const SitemapGenerator = require('sitemap-generator');

        // Erstelle den Sitemap Generator mit der gleichen Konfiguration wie in test.js
        const generator = SitemapGenerator(this.targetUrl, {
          filepath: null, // Kein File schreiben, nur URLs sammeln
          stripQuerystring: false,
          maxEntriesPerFile: 50000,
          changeFreq: 'weekly',
          lastMod: true,
          userAgent: this.currentUserAgent,
          ignoreAMP: false
        });

        const discoveredUrls = [];
        let isCompleted = false;

        // Event-Handler für URL-Sammlung
        generator.on('add', url => {
          discoveredUrls.push(url);
          console.log(`✅ URL gefunden: ${url}`);
        });

        generator.on('ignore', url => {
          console.log(`⚠️ URL ignoriert: ${url}`);
        });

        generator.on('error', error => {
          console.error(
            `❌ Crawling-Fehler: ${error.message} (${error.code}) - URL: ${
              error.url
            }`
          );
        });

        generator.on('done', () => {
          if (!isCompleted) {
            isCompleted = true;
            console.log(
              `✅ Level 0 Success: ${discoveredUrls.length} URLs discovered`
            );

            // Generiere HTML-ähnliche Struktur für Kompatibilität mit extractUrlsFromHtml
            const mockHtml = this.generateMockHtmlFromUrls(discoveredUrls);
            resolve(mockHtml);
          }
        });

        // Erweiterte Crawler-Konfiguration
        const crawler = generator.getCrawler();
        crawler.maxConcurrency = 5;
        crawler.interval = 100;
        crawler.timeout = 15000;

        // Filter für Links in nav und footer Tags
        // Wir verwenden einen anderen Ansatz: Wir analysieren die HTML-Inhalte
        // und markieren URLs die in nav/footer gefunden werden
        this.navFooterUrls = new Set();
        
        crawler.on('fetchcomplete', (queueItem, responseBuffer, response) => {
          try {
            const html = responseBuffer.toString();
            const navFooterLinks = this.extractNavFooterLinks(html);
            navFooterLinks.forEach(url => this.navFooterUrls.add(url));
          } catch (error) {
            // Ignoriere Parsing-Fehler
          }
        });

        crawler.addFetchCondition((queueItem, referrerQueueItem, callback) => {
          // Prüfen ob die URL in nav oder footer gefunden wurde
          if (this.navFooterUrls.has(queueItem.url)) {
            console.log(`🚫 Link ignoriert (nav/footer): ${queueItem.url}`);
            callback(null, false);
          } else {
            callback(null, true);
          }
        });

        // Statische URLs hinzufügen
        crawler.on('crawlstart', () => {
          console.log('🚀 SitemapGenerator gestartet...');
          const sitemap = generator.getSitemap();

          const staticUrls = [
            '/leistungen/',
            '/leistungen/leistungen-a-z/',
            '/kontakt/',
            '/impressum/',
            '/datenschutz/'
          ];

          staticUrls.forEach(url => {
            sitemap.addURL(url);
            console.log(`📌 Statische URL hinzugefügt: ${url}`);
          });
        });

        // Timeout als Fallback
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true;
            console.log(
              `⏰ Level 0 Timeout: ${
                discoveredUrls.length
              } URLs collected so far`
            );
            const mockHtml = this.generateMockHtmlFromUrls(discoveredUrls);
            resolve(mockHtml);
          }
        }, 60000); // 60 Sekunden Timeout

        // Starte den Generator
        generator.start();

        // Cleanup bei Completion
        generator.on('done', () => {
          clearTimeout(timeout);
        });
      } catch (error) {
        console.error(`❌ Level 0 Failed: ${error.message}`);
        reject(error);
      }
    });
  }

  // Hilfsmethode: Generiere Mock-HTML aus URLs für Kompatibilität
  generateMockHtmlFromUrls(urls) {
    let mockHtml = '<html><head><title>Mock HTML</title></head><body>';
    urls.forEach(url => {
      mockHtml += `<a href="${url}">${url}</a>\n`;
    });
    mockHtml += '</body></html>';
    return mockHtml;
  }

  // Hilfsmethode: Extrahiere Links aus nav und footer Tags
  extractNavFooterLinks(html) {
    const cheerio = require('cheerio');
    const links = new Set();
    
    try {
      const $ = cheerio.load(html);
      
      // Finde alle Links in nav und footer Tags
      $('nav a[href], footer a[href]').each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          // Konvertiere relative URLs zu absoluten URLs
          let absoluteUrl;
          
          if (href.startsWith('http://') || href.startsWith('https://')) {
            absoluteUrl = href;
          } else if (href.startsWith('//')) {
            const baseUrlObj = new URL(this.baseUrl);
            absoluteUrl = baseUrlObj.protocol + href;
          } else if (href.startsWith('/')) {
            absoluteUrl = this.baseUrl.replace(/\/$/, '') + href;
          } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            // Relative URL
            absoluteUrl = this.baseUrl.replace(/\/$/, '') + '/' + href;
          }
          
          if (absoluteUrl) {
            links.add(absoluteUrl);
          }
        }
      });
      
      console.log(`🔍 Nav/Footer Links gefunden: ${links.size} URLs`);
      if (links.size > 0) {
        console.log(`📋 Nav/Footer URLs: ${Array.from(links).slice(0, 3).join(', ')}${links.size > 3 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.warn(`⚠️ Fehler beim Parsen von nav/footer Links: ${error.message}`);
    }
    
    return Array.from(links);
  }

  // Python Dependencies Management
  async ensurePythonDependencies() {
    console.log('🐍 Checking Python dependencies...');

    try {
      // Check if requirements.txt exists
      const requirementsPath = path.join(__dirname, 'requirements.txt');
      if (!fs.existsSync(requirementsPath)) {
        console.log('⚠️ requirements.txt not found, skipping dependency check');
        return false;
      }

      // Try to import required packages to check if they're installed
      try {
        execSync(
          'python3 -c "import bs4, markdownify, requests, lxml, urllib3, xmltodict"',
          {
            stdio: 'pipe'
          }
        );
        console.log('✅ All Python dependencies are installed');
        return true;
      } catch (importError) {
        console.log('📦 Installing Python dependencies...');

        // Install dependencies
        execSync(`python3 -m pip install -r "${requirementsPath}"`, {
          stdio: 'inherit'
        });

        console.log('✅ Python dependencies installed successfully');
        return true;
      }
    } catch (error) {
      console.error(
        `❌ Failed to install Python dependencies: ${error.message}`
      );
      console.log(
        '💡 Please install manually: python3 -m pip install -r requirements.txt'
      );
      return false;
    }
  }

  // Markdown Conversion
  async convertSitemapToMarkdown() {
    console.log('\n📝 Starting Markdown conversion...');

    try {
      // Ensure Python dependencies are installed
      const depsInstalled = await this.ensurePythonDependencies();
      if (!depsInstalled) {
        console.log(
          '⚠️ Skipping Markdown conversion due to missing dependencies'
        );
        return false;
      }

      // Check if sitemap file exists
      if (!fs.existsSync(this.sitemapFile)) {
        console.log(`❌ Sitemap file not found: ${this.sitemapFile}`);
        return false;
      }

      // Check if markdown_converter.py exists
      const converterPath = path.join(__dirname, 'markdown_converter.py');
      if (!fs.existsSync(converterPath)) {
        console.log(`❌ Markdown converter not found: ${converterPath}`);
        return false;
      }

      console.log(`📄 Sitemap: ${this.sitemapFile}`);
      console.log(`📁 Output: ${this.markdownOutputDir}`);

      // Execute Python markdown converter
      const command = `python3 "${converterPath}" --sitemap "${
        this.sitemapFile
      }" --output "${this.markdownOutputDir}"`;
      console.log(`🚀 Executing: ${command}`);

      execSync(command, {
        stdio: 'inherit',
        cwd: __dirname
      });

      console.log('✅ Markdown conversion completed successfully!');
      console.log(`📁 Markdown files saved to: ${this.markdownOutputDir}`);
      return true;
    } catch (error) {
      console.error(`❌ Markdown conversion failed: ${error.message}`);
      return false;
    }
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

  // LEVEL 4: Puppeteer AOK regional flow extracting only <ol> links
  async fetchWithAOKRegion(regionCode) {
    console.log(`🏥 LEVEL 4: AOK Regional Attack (${regionCode})...`);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent(this.currentUserAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
      });

      // Navigate
      // Normalize target to the canonical Leistungen page
      const aokLeistungenUrl = 'https://www.aok.de/pk/leistungen/';
      const target = /\/leistungen\/?$/.test(this.targetUrl) ? this.targetUrl : aokLeistungenUrl;
      await page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });

      // Set region via sessionStorage and cookie
      if (regionCode && regionCode !== 'UNI') {
        // Accept cookie banner if present (Usercentrics / generic)
        try {
          // Try Usercentrics API if available
          await page.evaluate(() => {
            try { if (window.UC_UI && typeof window.UC_UI.acceptAll === 'function') { window.UC_UI.acceptAll(); } } catch (e) {}
            const btn =
              document.querySelector('button[data-testid="uc-accept-all-button"]') ||
              document.querySelector('#usercentrics-accept-all') ||
              Array.from(document.querySelectorAll('button')).find(b => /alle akzeptieren|accept all/i.test((b.textContent || '').toLowerCase()));
            if (btn) btn.click();
          });
          await new Promise(r => setTimeout(r, 1200));
        } catch (_) {}

        await page.evaluate((code) => {
          try {
            sessionStorage.setItem('aoklv', code);
            localStorage.setItem('aoklv', code);
          } catch (e) {}
        }, regionCode);
        await page.setCookie({
          name: 'aok_location',
          value: String(regionCode),
          domain: '.aok.de',
          path: '/',
          expires: Math.floor(Date.now()/1000) + 365*24*60*60
        });
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
        // Scroll to trigger lazy-loaded content
        await page.evaluate(async () => {
          await new Promise(res => setTimeout(res, 600));
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Extract only links inside <ol>
      try {
        await page.waitForFunction(() => document.querySelectorAll('ol a[href]').length > 0, { timeout: 15000 });
      } catch (_) {}
      let links = await page.evaluate(() => {
        const collected = new Set();
        document.querySelectorAll('ol a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
          try {
            const abs = new URL(href, window.location.href).href;
            collected.add(abs);
          } catch (_) {}
        });
        return Array.from(collected);
      });

      // Region-aware filtering: keep only links belonging to the selected region
      try {
        const region = this.aokRegions && regionCode ? this.aokRegions.getByCode(regionCode) : null;
        const allRegions = this.aokRegions && typeof this.aokRegions.getAllRegions === 'function' ? this.aokRegions.getAllRegions() : [];
        const regionPrefix = region?.website ? (region.website.endsWith('/') ? region.website : region.website + '/') : null;
        // Ermittele die Slugs der Regionen (nach /pk/)
        const selectedSlug = (() => {
          try {
            if (!regionPrefix) return null;
            const u = new URL(regionPrefix);
            const parts = (u.pathname || '').split('/').filter(Boolean);
            return parts.length >= 2 ? parts[1] : null; // '/pk/<slug>/' -> parts[1]
          } catch (_) { return null; }
        })();
        const excludeSlugs = allRegions
          .filter(r => r && r.code && r.code !== regionCode && r.website)
          .map(r => {
            try {
              const u = new URL(r.website.endsWith('/') ? r.website : r.website + '/');
              const parts = (u.pathname || '').split('/').filter(Boolean);
              return parts.length >= 2 ? parts[1] : null;
            } catch (_) { return null; }
          })
          .filter(Boolean);

        const before = links.length;
        links = links.filter(u => {
          try {
            const url = new URL(u);
            const hostOk = url.hostname && url.hostname.replace(/^www\./, '').endsWith('aok.de');
            if (!hostOk) return false;
            const pathname = url.pathname || '';
            if (!pathname.startsWith('/pk/')) return false;
            const parts = pathname.split('/').filter(Boolean);
            // parts: ['pk', '<slug>', ...]
            const slug = parts.length >= 2 ? parts[1] : '';
            if (!slug) return false;
            // Ausschließen, wenn der slug zu einem anderen Bundesland gehört
            if (slug !== selectedSlug && excludeSlugs.includes(slug)) return false;
            return true;
          } catch (_) {
            return false;
          }
        });
        console.log(`🔎 Region filter applied (${regionCode}): ${links.length}/${before} kept | selected slug: ${selectedSlug} | excluded slugs: ${excludeSlugs.join(', ')}`);
      } catch (e) {
        console.warn(`⚠️ Region filtering skipped: ${e.message}`);
      }

      if (!links || links.length === 0) {
        // Fallback: simulate PLZ entry based on regions config
        const regionObj = this.aokRegions && regionCode ? this.aokRegions.getByCode(regionCode) : null;
        const plz = regionObj?.plz;
        if (plz) {
          console.log(`🔁 No links found. Simulating PLZ flow (${plz})...`);
          try {
            // Try to find PLZ input and submit
            // Common selectors: input[type="tel"], input[name*="plz"], input[name*="postal"]
            await page.evaluate((postalCode) => {
              const input = document.querySelector('input[type="tel"], input[name*="plz" i], input[name*="postal" i]');
              if (input) {
                input.value = postalCode;
                const evt = new Event('input', { bubbles: true });
                input.dispatchEvent(evt);
              }
              const btn = document.querySelector('button[type="submit"], button[name="submit"]');
              if (btn) btn.click();
            }, plz);

            // Wait for navigation/content update
            await new Promise(r => setTimeout(r, 2500));
            try { await page.waitForFunction(() => document.querySelectorAll('ol a[href]').length > 0, { timeout: 12000 }); } catch (_) {}
            let linksPlz = await page.evaluate(() => {
              const set = new Set();
              document.querySelectorAll('ol a[href]').forEach(a => {
                const href = a.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
                try { set.add(new URL(href, window.location.href).href); } catch (_) {}
              });
              return Array.from(set);
            });
            // Apply the same region filtering to PLZ links
            try {
              const allRegions = this.aokRegions && typeof this.aokRegions.getAllRegions === 'function' ? this.aokRegions.getAllRegions() : [];
              const regionPrefix = regionObj?.website ? (regionObj.website.endsWith('/') ? regionObj.website : regionObj.website + '/') : null;
              const selectedSlug = (() => {
                try {
                  if (!regionPrefix) return null;
                  const u = new URL(regionPrefix);
                  const parts = (u.pathname || '').split('/').filter(Boolean);
                  return parts.length >= 2 ? parts[1] : null;
                } catch (_) { return null; }
              })();
              const excludeSlugs = allRegions
                .filter(r => r && r.code && r.code !== regionCode && r.website)
                .map(r => {
                  try {
                    const u = new URL(r.website.endsWith('/') ? r.website : r.website + '/');
                    const parts = (u.pathname || '').split('/').filter(Boolean);
                    return parts.length >= 2 ? parts[1] : null;
                  } catch (_) { return null; }
                })
                .filter(Boolean);

              const beforePlz = linksPlz.length;
              linksPlz = linksPlz.filter(u => {
                try {
                  const url = new URL(u);
                  const hostOk = url.hostname && url.hostname.replace(/^www\./, '').endsWith('aok.de');
                  if (!hostOk) return false;
                  const pathname = url.pathname || '';
                  if (!pathname.startsWith('/pk/')) return false;
                  const parts = pathname.split('/').filter(Boolean);
                  const slug = parts.length >= 2 ? parts[1] : '';
                  if (!slug) return false;
                  if (slug !== selectedSlug && excludeSlugs.includes(slug)) return false;
                  return true;
                } catch (_) {
                  return false;
                }
              });
              console.log(`🔎 Region filter (PLZ) applied (${regionCode}): ${linksPlz.length}/${beforePlz} kept | selected slug: ${selectedSlug} | excluded slugs: ${excludeSlugs.join(', ')}`);
            } catch (e2) {
              console.warn(`⚠️ Region filtering (PLZ) skipped: ${e2.message}`);
            }
            console.log(`✅ AOK PLZ flow extracted ${linksPlz.length} region-specific links`);
            return this.generateMockHtmlFromUrls(linksPlz);
          } catch (e) {
            console.warn(`⚠️ PLZ simulation failed: ${e.message}`);
          }
        }
      }
      if (!links || links.length === 0) {
        // Dump debug HTML to inspect structure
        try {
          const debugDir = path.resolve('./debug');
          if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
          const html = await page.content();
          const debugFile = path.join(debugDir, `aok-${(regionCode||'UNI').toLowerCase()}.html`);
          fs.writeFileSync(debugFile, html, 'utf8');
          console.log(`🧪 Debug HTML saved: ${debugFile}`);
        } catch (_) {}
      }
      console.log(`✅ AOK (<ol>) extracted ${links.length} region-specific links`);
      return this.generateMockHtmlFromUrls(links);
    } catch (error) {
      console.error(`❌ AOK regional extraction failed: ${error.message}`);
      throw error;
    } finally {
      if (browser) await browser.close();
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

      // Only include URLs that were extracted from the html content

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
      console.log(
        `📋 Strategy: Level 0 → Level 1 → Level 2 → Level 3 (until success)\n`
      );

      let html = null;

      // Try each level until success
      for (
        this.currentLevel = 0;
        this.currentLevel <= this.maxLevel;
        this.currentLevel++
      ) {
        try {
          console.log(`\n🌑 === ATTACK LEVEL ${this.currentLevel} ===`);

          // Fetch HTML based on current level
          switch (this.currentLevel) {
            case 0:
              html = await this.fetchWithSitemapGenerator();
              break;
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

            // Start Markdown conversion after successful sitemap generation
            const markdownSuccess = await this.convertSitemapToMarkdown();
            if (markdownSuccess) {
              console.log(`\n🎉 COMPLETE WORKFLOW SUCCESS!`);
              console.log(`🗺️ Sitemap: ${this.sitemapFile}`);
              console.log(`📝 Markdown: ${this.markdownOutputDir}`);
            } else {
              console.log(
                `\n⚠️ Sitemap generated but Markdown conversion failed`
              );
              console.log(`🗺️ Sitemap available at: ${this.sitemapFile}`);
            }

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
        `\n💀 DEMENTOR DEFEATED: All ${this.maxLevel + 1} levels (0-${
          this.maxLevel
        }) failed to extract sufficient URLs`
      );
      const finalCount = this.countUrlsInSitemap();
      console.log(
        `📊 Final result: ${finalCount} URLs extracted`
      );
      console.log(`🎯 Required: ${this.minUrlsRequired} URLs minimum`);
      console.log(`🛡️ Target has strong anti-bot protection`);

      // If only one link was found overall, mark sitemap as error and move it
      if (finalCount === 1) {
        const movedPath = this.moveSitemapToErrorDir();
        console.log(`🚫 Only one link found overall. Moving sitemap → ${movedPath || 'error-sitemaps'}`);
      }

      await this.cleanup();
    } catch (error) {
      console.error(`❌ Critical Dementor error: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  // Supabase workflow: iterate insurers and run Level 0 targeted extraction
  async runSupabaseWorkflow() {
    try {
      console.log('🌑 DEMENTOR EVOLUTION - Supabase Level 0 Workflow');
      const initialized = this.initSupabaseClient();
      if (!initialized) {
        console.log('❌ Supabase not initialized. Aborting Supabase workflow.');
        return;
      }

      const insurers = await this.fetchInsurersFromSupabase();
      if (!insurers || insurers.length === 0) {
        console.log('⚠️ No insurers found in Supabase.');
        return;
      }

      // Ensure output directories base exist
      const sitemapBaseDir = path.resolve('./sitemaps');
      const markdownBaseDir = path.resolve('./markdown-output');
      if (!fs.existsSync(sitemapBaseDir)) fs.mkdirSync(sitemapBaseDir, { recursive: true });
      if (!fs.existsSync(markdownBaseDir)) fs.mkdirSync(markdownBaseDir, { recursive: true });

      for (const row of insurers) {
        try {
          const name = row.name || 'insurer';
          const slug = this.slugifyName(name);
          this.targetUrl = row.leistungen_url;
          this.selectorHtmlTarget = row.html_target;
          // Update baseUrl to match current targetUrl
          this.baseUrl = this.extractBaseUrl(this.targetUrl);

          // Configure paths per insurer
          this.sitemapFile = path.join(sitemapBaseDir, `${slug}.xml`);
          this.markdownOutputDir = path.join(markdownBaseDir, slug);
          if (!fs.existsSync(this.markdownOutputDir)) {
            fs.mkdirSync(this.markdownOutputDir, { recursive: true });
          }

          console.log(`\n🏥 Processing: ${name}`);
          console.log(`🔗 Leistungen URL: ${this.targetUrl}`);
          console.log(`🎯 HTML Target: ${this.selectorHtmlTarget}`);
          console.log(`🗺️ Sitemap file: ${this.sitemapFile}`);
          console.log(`📝 Markdown dir: ${this.markdownOutputDir}`);

          // Special case: AOK handling
          const aok = this.detectAOKRegion(row);
          const skipAOK = this.shouldSkipAOKSpecialHandling(row);
          if (aok.isAOK && !skipAOK) {
            console.log(`🏥 AOK erkannt: ${name} (Region: ${aok.code})`);
            const regionSuffix = aok.code ? `-${aok.code.toLowerCase()}` : '';
            this.sitemapFile = path.join(sitemapBaseDir, `${slug}${regionSuffix}.xml`);
            this.markdownOutputDir = path.join(markdownBaseDir, `${slug}${regionSuffix}`);
            if (!fs.existsSync(this.markdownOutputDir)) {
              fs.mkdirSync(this.markdownOutputDir, { recursive: true });
            }

            // Run regional AOK extractor
            const mockHtmlAok = await this.fetchWithAOKRegion(aok.code);
            await this.generateSitemap(mockHtmlAok);
            const urlCountAok = this.countUrlsInSitemap();
            console.log(`📊 Extracted ${urlCountAok} regional URLs for ${name} (${aok.code})`);

            // If only one link was found, mark sitemap as error and skip markdown
            if (urlCountAok === 1) {
              const movedPath = this.moveSitemapToErrorDir();
              console.log(`🚫 Only one link found. Skipping markdown and moving sitemap → ${movedPath || 'error-sitemaps'}`);
              await this.cleanup();
              continue; // proceed to next insurer
            }

            if (urlCountAok >= this.minUrlsRequired) {
              const markdownSuccess = await this.convertSitemapToMarkdown();
              if (markdownSuccess) {
                console.log(`🎉 Markdown conversion success for ${name} (${aok.code})`);
              } else {
                console.log(`⚠️ Markdown conversion failed for ${name} (${aok.code})`);
              }
            } else {
              console.log(`⚠️ Not enough regional URLs for ${name} (${aok.code}) (found ${urlCountAok}, required ${this.minUrlsRequired})`);
            }

            await this.cleanup();
            continue; // proceed to next insurer
          }
          if (aok.isAOK && skipAOK) {
            console.log(`🛑 AOK-Sonderprozess deaktiviert für: ${name}. Verwende generische Extraktion.`);
          }

          // Level 0: targeted link extraction
          const mockHtml = await this.fetchLinksFromHtmlTarget(
            this.targetUrl,
            this.selectorHtmlTarget
          );

          // Generate sitemap from mock HTML
          await this.generateSitemap(mockHtml);

          const urlCount = this.countUrlsInSitemap();
          console.log(`📊 Extracted ${urlCount} URLs for ${name}`);

          // If only one link was found, mark sitemap as error and skip markdown
          if (urlCount === 1) {
            const movedPath = this.moveSitemapToErrorDir();
            console.log(`🚫 Only one link found. Skipping markdown and moving sitemap → ${movedPath || 'error-sitemaps'}`);
            await this.cleanup();
            continue; // proceed to next insurer
          }

          if (urlCount >= this.minUrlsRequired) {
            // Convert to markdown
            const markdownSuccess = await this.convertSitemapToMarkdown();
            if (markdownSuccess) {
              console.log(`🎉 Markdown conversion success for ${name}`);
            } else {
              console.log(`⚠️ Markdown conversion failed for ${name}`);
            }
          } else {
            console.log(`⚠️ Not enough URLs for ${name} (found ${urlCount}, required ${this.minUrlsRequired})`);
          }

          await this.cleanup();
        } catch (rowError) {
          console.error(`❌ Failed processing insurer '${row.name}': ${rowError.message}`);
          await this.cleanup();
        }
      }

      console.log('\n✅ Supabase Level 0 workflow finished');
    } catch (error) {
      console.error(`❌ Supabase workflow error: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  // Move the current sitemap to an error directory, prefixing filename with 'error-'
  moveSitemapToErrorDir(prefix = 'error-') {
    try {
      const errorDir = path.resolve('./error-sitemaps');
      if (!fs.existsSync(errorDir)) {
        fs.mkdirSync(errorDir, { recursive: true });
      }

      const base = path.basename(this.sitemapFile);
      const destBase = base.startsWith(prefix) ? base : `${prefix}${base}`;
      let destPath = path.join(errorDir, destBase);

      // If a file with the same name already exists, append a timestamp
      if (fs.existsSync(destPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        destPath = path.join(errorDir, `${prefix}${timestamp}-${base}`);
      }

      fs.renameSync(this.sitemapFile, destPath);
      console.log(`📦 Sitemap moved to error directory: ${destPath}`);
      return destPath;
    } catch (err) {
      console.warn(`⚠️ Failed to move sitemap to error-sitemaps: ${err.message}`);
      return null;
    }
  }

  // Determine if AOK special handling should be skipped for a given insurer
  shouldSkipAOKSpecialHandling(row) {
    try {
      const rawName = (row?.name || '').trim();
      const urlStr = (row?.leistungen_url || '').trim();

      // Name-based skip: match "AOK Sachsen-Anhalt" variants regardless of suffixes
      const nameMatches = /AOK\s*Sachsen[-\s]*Anhalt/i.test(rawName);
      if (nameMatches) return true;

      // URL-based heuristic: look for slug indicating Sachsen-Anhalt in path
      try {
        const u = new URL(urlStr);
        const path = (u.pathname || '').toLowerCase();
        if (/\/pk\/sachsen-anhalt\//.test(path) || /sachsen-anhalt/.test(path)) {
          return true;
        }
      } catch (_) {
        // ignore URL parse errors
      }

      return false;
    } catch (_) {
      return false;
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
    '⚡ Level 0: SitemapGen → Level 1: cURL → Level 2: Puppeteer → Level 3: Stealth ⚡'
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
    console.log('Der Dementor nutzt ein eskalierendes 4-Level-Angriffssystem:');
    console.log('📚 Level 0: SitemapGenerator Library Attack');
    console.log('🌐 Level 1: Enhanced cURL mit Header-Rotation');
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
      // Decide mode based on Supabase env presence
      const supabaseEnvPresent = !!(
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL
      ) && !!(
        process.env.SUPABASE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      if (supabaseEnvPresent) {
        console.log('🔌 Supabase environment detected. Running Supabase Level 0 workflow...');
        const dementor = new Dementor({
          sitemapFile: './dementor-sitemap.xml',
          markdownOutputDir: './markdown-output'
        });
        await dementor.runSupabaseWorkflow();
      } else {
        const targetUrl = await promptForUrl();

        console.log(`\n🎯 Ziel-URL: ${targetUrl}`);
        console.log('📋 Erwecke den Dementor Evolution...\n');

        const dementor = new Dementor({
          targetUrl: targetUrl,
          localPort: 3000,
          sitemapFile: './dementor-sitemap.xml'
        });

        await dementor.run();
      }
    } catch (error) {
      console.error('❌ Fehler beim Erwecken des Dementors:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = Dementor;
