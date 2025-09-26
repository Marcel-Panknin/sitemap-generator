# Sitemap Generator - API Funktionen Erklärt

## Übersicht
Der Sitemap Generator bietet eine einfache API zum Erstellen von XML-Sitemaps durch das Crawlen von Websites. Hier sind alle wichtigen Funktionen verständlich erklärt.

---

## 🚀 Hauptmethoden

### `start()`
**Was macht es:** Startet den Crawler und beginnt mit der Sitemap-Erstellung.

```javascript
const generator = SitemapGenerator('https://example.com');
generator.start(); // Crawler startet asynchron
```

**Wichtig:** 
- Läuft asynchron (blockiert nicht den Code)
- Schreibt die Sitemap automatisch auf die Festplatte
- Nutzen Sie Event-Listener um zu wissen, wann es fertig ist

---

### `stop()`
**Was macht es:** Stoppt den laufenden Crawler sofort.

```javascript
generator.stop(); // Crawler wird gestoppt, Sitemap-Erstellung wird abgebrochen
```

**Wann verwenden:** 
- Wenn der Crawler zu lange braucht
- Bei Fehlern oder wenn Sie abbrechen möchten

---

### `getCrawler()`
**Was macht es:** Gibt Ihnen direkten Zugriff auf den internen Crawler.

```javascript
const crawler = generator.getCrawler();

// Beispiel: Bestimmte URLs ignorieren
crawler.addFetchCondition((queueItem, referrerQueueItem, callback) => {
  // URLs mit "/admin/" werden ignoriert
  const shouldCrawl = !queueItem.path.includes('/admin/');
  callback(null, shouldCrawl);
});
```

**Praktische Anwendungen:**
- URLs mit bestimmten Mustern ausschließen
- Crawler-Verhalten anpassen
- Erweiterte Konfiguration

---

### `getSitemap()`
**Was macht es:** Gibt Ihnen Zugriff auf die Sitemap-Instanz.

```javascript
const crawler = generator.getCrawler();
const sitemap = generator.getSitemap();

// Statische URLs manuell hinzufügen
crawler.on('crawlstart', () => {
  sitemap.addURL('/impressum');
  sitemap.addURL('/datenschutz');
  sitemap.addURL('/kontakt');
});
```

**Wann nützlich:**
- Statische Seiten hinzufügen, die der Crawler nicht findet
- URLs manuell zur Sitemap hinzufügen
- Sitemap-Inhalt direkt manipulieren

---

### `queueURL(url)`
**Was macht es:** Fügt eine URL zur Crawler-Warteschlange hinzu.

```javascript
// Diese URL wird auch gecrawlt, auch wenn sie nicht verlinkt ist
generator.queueURL('https://example.com/versteckte-seite');
```

**Praktisch für:**
- Seiten die nicht verlinkt sind
- Wichtige URLs die der Crawler übersehen könnte
- Manuelle Steuerung des Crawling-Prozesses

---

## 📡 Event-System

Der Generator sendet Events aus, auf die Sie reagieren können:

### `'add'` Event
```javascript
generator.on('add', (url) => {
  console.log('✅ URL zur Sitemap hinzugefügt:', url);
});
```

### `'done'` Event
```javascript
generator.on('done', () => {
  console.log('🎉 Sitemap-Erstellung abgeschlossen!');
  // Hier können Sie weitere Aktionen ausführen
});
```

### `'error'` Event
```javascript
generator.on('error', (error) => {
  console.log('❌ Fehler beim Crawlen:', error);
  // error enthält: { code: 404, message: 'Not found.', url: 'http://...' }
});
```

### `'ignore'` Event
```javascript
generator.on('ignore', (url) => {
  console.log('⚠️ URL ignoriert (robots.txt oder noindex):', url);
});
```

---

## 🛠️ Praktisches Beispiel

```javascript
const SitemapGenerator = require('sitemap-generator');

// Generator erstellen
const generator = SitemapGenerator('https://meine-website.de', {
  filepath: './meine-sitemap.xml',
  stripQuerystring: true
});

// Crawler anpassen
const crawler = generator.getCrawler();
crawler.addFetchCondition((queueItem, referrerQueueItem, callback) => {
  // Admin-Bereich und temporäre Seiten ignorieren
  const shouldIgnore = queueItem.path.match(/\/(admin|temp|test)\//);
  callback(null, !shouldIgnore);
});

// Sitemap-Instanz für manuelle URLs
const sitemap = generator.getSitemap();

// Event-Listener einrichten
generator.on('add', (url) => console.log('➕', url));
generator.on('error', (error) => console.log('❌', error.message));
generator.on('done', () => {
  console.log('✅ Sitemap fertig erstellt!');
  console.log('📁 Datei: ./meine-sitemap.xml');
});

// Wichtige URLs manuell hinzufügen
crawler.on('crawlstart', () => {
  sitemap.addURL('/sitemap'); // Meta-Seite
  sitemap.addURL('/rss.xml'); // RSS Feed
});

// Versteckte aber wichtige Seite zur Warteschlange hinzufügen
generator.queueURL('https://meine-website.de/versteckte-landingpage');

// Crawler starten
generator.start();
```

---

## 💡 Tipps für die Praxis

1. **Event-Listener immer vor `start()` definieren**
2. **`getCrawler()` für erweiterte Filterung nutzen**
3. **`getSitemap()` für statische URLs verwenden**
4. **`queueURL()` für wichtige, nicht verlinkte Seiten**
5. **`stop()` als Notbremse bei Problemen**

---

## 🔗 Weiterführende Informationen

- Für detaillierte Crawler-Optionen: [SimpleCrawler Dokumentation](https://github.com/simplecrawler/simplecrawler#readme)
- Für Konfigurationsoptionen: Siehe README.md Abschnitt "Options"