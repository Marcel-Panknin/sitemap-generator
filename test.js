const SitemapGenerator = require('sitemap-generator');

// Erstelle den Sitemap Generator für die Heimat-Krankenkasse
const generator = SitemapGenerator(
  'https://www.heimat-krankenkasse.de/leistungen/leistungen-a-z/#filterType=Alle&filterId=Alle',
  {
    // Basis-Konfiguration
    filepath: './heimat-krankenkasse-sitemap.xml',
    stripQuerystring: false, // Behalte Query-Parameter bei (wichtig für Filter)
    maxEntriesPerFile: 50000,

    // User Agent anpassen
    userAgent: 'SitemapGenerator/Heimat-Krankenkasse-Bot',

    // Keine URL-Einschränkungen - crawle alles
    ignoreAMP: false // Auch AMP-Seiten einbeziehen
  }
);

// Event-Handler für verschiedene Ereignisse
generator.on('add', url => {
  console.log(`✅ URL zur Sitemap hinzugefügt: ${url}`);
});

generator.on('ignore', url => {
  console.log(`⚠️  URL ignoriert: ${url}`);
});

generator.on('error', error => {
  console.error(
    `❌ Fehler beim Crawlen: ${error.message} (${error.code}) - URL: ${
      error.url
    }`
  );
});

generator.on('done', () => {
  console.log('🎉 Sitemap-Generierung abgeschlossen!');
  console.log('📄 Sitemap gespeichert als: heimat-krankenkasse-sitemap.xml');
});

// Erweiterte Crawler-Konfiguration
const crawler = generator.getCrawler();

// Crawler-Einstellungen für maximale Erfassung
crawler.maxConcurrency = 5; // Mehr gleichzeitige Verbindungen
crawler.interval = 100; // Kürzere Pause zwischen Requests
crawler.timeout = 15000; // Längeres Timeout für langsame Seiten

// Zusätzliche URLs manuell hinzufügen (falls nötig)
crawler.on('crawlstart', () => {
  console.log('🚀 Sitemap-Generierung gestartet...');
  console.log(
    '🌐 Basis-URL: https://www.heimat-krankenkasse.de/leistungen/leistungen-a-z/'
  );

  const sitemap = generator.getSitemap();

  // Wichtige statische URLs hinzufügen
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

// Fortschritts-Tracking
let urlCount = 0;
crawler.on('fetchcomplete', () => {
  urlCount++;
  if (urlCount % 10 === 0) {
    console.log(`📊 Fortschritt: ${urlCount} URLs verarbeitet`);
  }
});

// Starte den Crawler
console.log('🔍 Starte Sitemap-Generierung für Heimat-Krankenkasse...');
generator.start();

// Graceful shutdown bei CTRL+C
process.on('SIGINT', () => {
  console.log('\n⏹️  Sitemap-Generierung wird gestoppt...');
  generator.stop();
  process.exit(0);
});
