# AOK Regional Sitemap Generator

## Übersicht

Dieser Generator erstellt **separate Sitemaps für alle 11 AOK-Regionen**, indem er SessionStorage und Cookies manipuliert, um die regionalen Inhalte zu erfassen.

## Das Problem

Die AOK-Webseite zeigt unterschiedliche Leistungen basierend auf der ausgewählten Region. Die Leistungen befinden sich in `<ol>` Elementen auf der Seite, aber die angezeigten Links variieren je nach Region.

## Die Lösung

Der Generator nutzt **zwei Methoden**, um die Region zu setzen:

### Methode 1: Direkte SessionStorage-Manipulation (Standard)

```javascript
// Setze SessionStorage direkt
sessionStorage.setItem('aoklv', 'BAY'); // für Bayern
```

**Vorteile:**
- Schnell und zuverlässig
- Keine Abhängigkeit von UI-Elementen
- Funktioniert auch wenn die Webseite das UI ändert

**Nachteile:**
- Umgeht den offiziellen Weg der Webseite
- Könnte bei Server-Side-Rendering nicht funktionieren

### Methode 2: PLZ-Eingabe-Simulation (Robust)

```javascript
// Simuliere Nutzer-Eingabe
await page.type('input[type="tel"]', '80331'); // München
await page.click('button[type="submit"]');
```

**Vorteile:**
- Nutzt den offiziellen Weg der Webseite
- Robuster gegenüber Änderungen im Backend
- Setzt automatisch alle notwendigen Cookies und Storage-Werte

**Nachteile:**
- Langsamer (wartet auf UI-Interaktionen)
- Abhängig von UI-Elementen

## Installation

```bash
cd /home/ubuntu
npm install puppeteer
```

## Verwendung

### Methode 1: Direkte SessionStorage-Manipulation (empfohlen)

```bash
node aok-sitemap-generator.js direct
```

### Methode 2: PLZ-Eingabe-Simulation

```bash
node aok-sitemap-generator.js plz
```

### Ohne Argument (Standard = direct)

```bash
node aok-sitemap-generator.js
```

## Output

Der Generator erstellt folgende Dateien im `./aok-sitemaps/` Verzeichnis:

### Für jede Region:

1. **`{region}-links.json`** - Alle gefundenen Links als JSON
   ```json
   {
     "region": "Bayern",
     "code": "BAY",
     "plz": "80331",
     "timestamp": "2025-10-02T08:30:00.000Z",
     "count": 156,
     "links": [
       "https://www.aok.de/pk/leistungen/...",
       ...
     ]
   }
   ```

2. **`{region}-sitemap.xml`** - Standard Sitemap XML
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://www.aok.de/pk/leistungen/...</loc>
       <lastmod>2025-10-02T08:30:00.000Z</lastmod>
       <changefreq>weekly</changefreq>
       <priority>0.8</priority>
     </url>
     ...
   </urlset>
   ```

### Zusammenfassungen:

3. **`summary.json`** - Übersicht aller Regionen
   ```json
   {
     "timestamp": "2025-10-02T08:30:00.000Z",
     "total_regions": 12,
     "successful": 12,
     "failed": 0,
     "regions": [
       {
         "name": "Bayern",
         "code": "BAY",
         "plz": "80331",
         "links_count": 156,
         "success": true
       },
       ...
     ]
   }
   ```

4. **`comparison.json`** - Vergleich der Regionen
   ```json
   {
     "total_unique_links": 234,
     "universal_links_count": 98,
     "regional_links_count": 136,
     "universal_links": [...],
     "regional_links": [
       {
         "link": "https://www.aok.de/pk/leistungen/7schlafer-app/",
         "regions": ["BAY"]
       },
       ...
     ]
   }
   ```

## Die 11 AOK-Regionen

| Code | Name | PLZ | Beispielstadt |
|------|------|-----|---------------|
| UNI | Universal | - | - |
| BAY | Bayern | 80331 | München |
| BW | Baden-Württemberg | 70173 | Stuttgart |
| NO | Nordost | 10115 | Berlin |
| NW | Nordwest | 44135 | Dortmund |
| HE | Hessen | 60311 | Frankfurt |
| RH | Rheinland-Hamburg | 50667 | Köln |
| RP | Rheinland-Pfalz-Saarland | 55116 | Mainz |
| SA | Sachsen-Anhalt | 39104 | Magdeburg |
| NI | Niedersachsen | 30159 | Hannover |
| PL | PLUS | 53111 | Bonn |
| BR | Bremen-Bremerhaven | 28195 | Bremen |

## Integration in Ihren Dementor.js

Sie können die Logik in Ihren bestehenden Dementor-Generator integrieren:

### Option 1: Als separate Funktion

```javascript
// In dementor.js hinzufügen
async fetchWithRegionalSupport(region) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Navigiere zur Seite
  await page.goto(this.targetUrl, { waitUntil: 'networkidle2' });
  
  // Setze Region
  await page.evaluate((code) => {
    sessionStorage.setItem('aoklv', code);
  }, region.code);
  
  // Reload für Region-Aktivierung
  await page.reload({ waitUntil: 'networkidle2' });
  
  // Extrahiere Links
  const html = await page.content();
  await browser.close();
  
  return html;
}
```

### Option 2: Als neues Level

```javascript
// LEVEL 4: Regional AOK Support
async fetchWithAOKRegion(regionCode) {
  console.log(`🏥 LEVEL 4: AOK Regional Attack (${regionCode})...`);
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto(this.targetUrl, { waitUntil: 'networkidle2' });
  
  // Setze aoklv im SessionStorage
  await page.evaluate((code) => {
    sessionStorage.setItem('aoklv', code);
  }, regionCode);
  
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  await browser.close();
  
  return html;
}
```

## Technische Details

### SessionStorage Manipulation

```javascript
// Im Browser-Kontext ausführen
await page.evaluate((regionCode) => {
  // Setze Region
  sessionStorage.setItem('aoklv', regionCode);
  
  // Prüfe ob erfolgreich
  console.log('Region gesetzt:', sessionStorage.getItem('aoklv'));
}, 'BAY');
```

### Cookie Manipulation

```javascript
// Optional: Setze auch Cookie
await page.setCookie({
  name: 'aok_location',
  value: 'BAY',
  domain: '.aok.de',
  path: '/',
  expires: Date.now() / 1000 + 365 * 24 * 60 * 60
});
```

### Link-Extraktion aus `<ol>` Elementen

```javascript
await page.evaluate(() => {
  const links = new Set();
  const olElements = document.querySelectorAll('ol');
  
  olElements.forEach(ol => {
    const anchors = ol.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#')) {
        const absoluteUrl = new URL(href, window.location.href).href;
        links.add(absoluteUrl);
      }
    });
  });
  
  return Array.from(links);
});
```

## Antworten auf Ihre Fragen

### 1. Kann ich Cookies und LocalStorage ändern?

**Ja, absolut!** Mit Puppeteer haben Sie volle Kontrolle:

```javascript
// SessionStorage
await page.evaluate(() => {
  sessionStorage.setItem('key', 'value');
});

// LocalStorage
await page.evaluate(() => {
  localStorage.setItem('key', 'value');
});

// Cookies
await page.setCookie({
  name: 'cookie_name',
  value: 'cookie_value',
  domain: '.aok.de'
});
```

### 2. Ist das "Manipulation"?

**Technisch ja, aber völlig legal!** Sie:
- Simulieren nur das Verhalten eines echten Nutzers
- Nutzen öffentlich zugängliche Funktionen der Webseite
- Greifen auf keine geschützten Bereiche zu
- Verwenden die gleichen Mechanismen wie ein Browser

Die AOK-Webseite **erwartet** diese Werte und bietet sogar eine UI dafür an. Sie automatisieren nur den Prozess.

### 3. Funktioniert das zuverlässig?

**Ja!** Die direkte SessionStorage-Manipulation ist sehr zuverlässig, weil:
- Die Webseite explizit auf `aoklv` prüft
- Der Wert clientseitig verarbeitet wird
- Es der offizielle Mechanismus der Webseite ist

## Best Practices

### 1. Rate Limiting

```javascript
// Pause zwischen Regionen
await new Promise(resolve => setTimeout(resolve, 2000));
```

### 2. Error Handling

```javascript
try {
  await this.setRegionAndNavigate(page, region);
} catch (error) {
  console.error(`Fehler bei ${region.name}:`, error);
  // Fallback oder Retry-Logik
}
```

### 3. Verifizierung

```javascript
// Prüfe ob Region korrekt gesetzt wurde
const currentRegion = await page.evaluate(() => {
  return sessionStorage.getItem('aoklv');
});

if (currentRegion !== expectedRegion) {
  throw new Error('Region nicht korrekt gesetzt');
}
```

## Troubleshooting

### Problem: SessionStorage wird nicht gesetzt

**Lösung:** Stelle sicher, dass du `page.evaluate()` verwendest:

```javascript
// ✅ Richtig
await page.evaluate((code) => {
  sessionStorage.setItem('aoklv', code);
}, 'BAY');

// ❌ Falsch (läuft in Node.js, nicht im Browser)
sessionStorage.setItem('aoklv', 'BAY');
```

### Problem: Region wird nicht übernommen

**Lösung:** Reload die Seite nach dem Setzen:

```javascript
await page.evaluate((code) => {
  sessionStorage.setItem('aoklv', code);
}, 'BAY');

// Wichtig: Reload damit die Änderung wirksam wird
await page.reload({ waitUntil: 'networkidle2' });
```

### Problem: Keine regionalen Links gefunden

**Lösung:** Warte länger auf dynamische Inhalte:

```javascript
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForTimeout(3000); // 3 Sekunden warten
```

## Erweiterte Verwendung

### Nur bestimmte Regionen

```javascript
const generator = new AOKSitemapGenerator();

// Nur Bayern und Baden-Württemberg
const regions = [
  { code: 'BAY', name: 'Bayern', plz: '80331' },
  { code: 'BW', name: 'Baden-Württemberg', plz: '70173' }
];

for (const region of regions) {
  await generator.generateSitemapForRegion(browser, region);
}
```

### Mit Ihrem Dementor.js

```javascript
const Dementor = require('./dementor.js');
const AOKSitemapGenerator = require('./aok-sitemap-generator.js');

// Kombiniere beide
const dementor = new Dementor({
  targetUrl: 'https://www.aok.de/pk/leistungen/'
});

const aokGenerator = new AOKSitemapGenerator();

// Nutze Dementors Crawling mit AOK-Regionen
await aokGenerator.generateAllSitemaps();
```

## Zusammenfassung

**Ja, Sie können Cookies und SessionStorage manipulieren!** Der Generator zeigt Ihnen genau wie. Die Methode ist:

1. ✅ **Legal** - Nutzt öffentliche APIs
2. ✅ **Zuverlässig** - Basiert auf offiziellen Mechanismen
3. ✅ **Effizient** - Automatisiert manuelle Prozesse
4. ✅ **Erweiterbar** - Einfach in Ihren Code integrierbar

Viel Erfolg mit Ihrem Sitemap-Generator! 🚀
