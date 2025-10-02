# Quick Start Guide - AOK Regions Management

## 🎯 Kurze Antwort auf Ihre Frage

**Nein, Sie müssen die Kürzel nicht manuell abspeichern!**

Ich habe für Sie ein **zentrales Regions-Management-System** erstellt:

- ✅ **aok-regions-config.json** - Alle Regionscodes mit Metadaten
- ✅ **aok-regions.js** - JavaScript-Modul zum einfachen Zugriff
- ✅ Automatisches Laden und Validierung
- ✅ Wiederverwendbar in allen Projekten

## 📦 Was ist enthalten?

### 1. Zentrale Konfiguration
```
aok-regions-config.json    ← Alle Regionscodes hier gespeichert
```

### 2. JavaScript-Modul
```javascript
const { getAOKRegions } = require('./aok-regions.js');
const regions = getAOKRegions();

// Fertig! Alle Regionen verfügbar
```

### 3. Verwendung

#### Option A: Einfach importieren
```javascript
const { getAOKRegions } = require('./aok-regions.js');
const regions = getAOKRegions();

// Alle Regionen abrufen
const allRegions = regions.getAllRegions();

// Nach Code suchen
const bayern = regions.getByCode('BAY');

// Nach PLZ suchen
const region = regions.getByPLZ('80331');
```

#### Option B: CLI verwenden
```bash
# Alle Regionen anzeigen
node aok-regions.js list

# Alle Codes anzeigen
node aok-regions.js codes

# Region suchen
node aok-regions.js find BAY
node aok-regions.js find 80331

# Export
node aok-regions.js export json
node aok-regions.js export csv
node aok-regions.js export markdown
```

## 🚀 Sitemap-Generator verwenden

### Version 2.0 (mit Regions-Modul)

```bash
# Alle Regionen
node aok-sitemap-generator-v2.js

# Nur bestimmte Regionen
node aok-sitemap-generator-v2.js direct BAY BW NO

# Mit PLZ-Methode
node aok-sitemap-generator-v2.js plz BAY
```

### Vorteile der v2.0:
- ✅ Automatisches Laden der Regionen
- ✅ Keine hardcoded Werte
- ✅ Einfach erweiterbar
- ✅ Zentrale Verwaltung

## 📝 Die 12 Regionscodes

| Code | Name | PLZ | Stadt |
|------|------|-----|-------|
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
| PL | PLUS | 01067 | Dresden |
| BR | Bremen-Bremerhaven | 28195 | Bremen |

**Diese sind bereits in `aok-regions-config.json` gespeichert!**

## 🔧 Integration in Ihren Dementor.js

### Schritt 1: Regions-Modul kopieren
```bash
cp aok-regions.js /pfad/zu/ihrem/projekt/
cp aok-regions-config.json /pfad/zu/ihrem/projekt/
```

### Schritt 2: In Dementor.js importieren
```javascript
const { getAOKRegions } = require('./aok-regions.js');

class Dementor {
  constructor(options = {}) {
    // ... bestehender Code ...
    
    // Regions-Manager hinzufügen
    this.regionsManager = getAOKRegions();
  }
  
  // Neue Methode für regionale Sitemaps
  async generateRegionalSitemaps() {
    const regions = this.regionsManager.getRegionsWithPLZ();
    
    for (const region of regions) {
      console.log(`Generiere Sitemap für ${region.name}...`);
      
      // Setze Region im Browser
      await this.page.evaluate((code) => {
        sessionStorage.setItem('aoklv', code);
      }, region.code);
      
      await this.page.reload();
      
      // Extrahiere Links
      const html = await this.page.content();
      const urls = this.extractUrlsFromHtml(html);
      
      // Speichere Sitemap
      this.saveSitemap(urls, `${region.code.toLowerCase()}-sitemap.xml`);
    }
  }
}
```

### Schritt 3: Verwenden
```javascript
const dementor = new Dementor({
  targetUrl: 'https://www.aok.de/pk/leistungen/'
});

// Generiere Sitemaps für alle Regionen
await dementor.generateRegionalSitemaps();
```

## 💡 Warum dieses System?

### ❌ Ohne Regions-Management:
```javascript
// Hardcoded - schlecht wartbar
const regions = [
  { code: 'BAY', plz: '80331' },
  { code: 'BW', plz: '70173' },
  // ... manuell pflegen
];
```

### ✅ Mit Regions-Management:
```javascript
// Zentral verwaltet - einfach wartbar
const regions = getAOKRegions();
const allRegions = regions.getAllRegions();
```

**Vorteile:**
1. ✅ Einmal definieren, überall verwenden
2. ✅ Automatische Validierung
3. ✅ Einfache Erweiterung (neue Region → nur JSON ändern)
4. ✅ Typsicher und dokumentiert
5. ✅ Export in verschiedene Formate

## 📚 Weitere Beispiele

### Beispiel 1: Nur Bayern und BW
```javascript
const generator = new AOKSitemapGenerator();
await generator.generateForCodes(['BAY', 'BW']);
```

### Beispiel 2: Alle außer Universal
```javascript
const regions = getAOKRegions();
const withPLZ = regions.getRegionsWithPLZ();

for (const region of withPLZ) {
  // Verarbeite Region
}
```

### Beispiel 3: Code-Validierung
```javascript
const regions = getAOKRegions();

if (regions.isValidCode('BAY')) {
  const bayern = regions.getByCode('BAY');
  console.log(`Region: ${bayern.name}, PLZ: ${bayern.plz}`);
}
```

### Beispiel 4: PLZ zu Region
```javascript
const regions = getAOKRegions();
const userPLZ = '80331';
const region = regions.getByPLZ(userPLZ);

console.log(`PLZ ${userPLZ} gehört zu: ${region.name}`);
```

## 🎓 Best Practices

### 1. Immer das Modul verwenden
```javascript
// ✅ Gut
const regions = getAOKRegions();
const bayern = regions.getByCode('BAY');

// ❌ Schlecht
const bayern = { code: 'BAY', plz: '80331' }; // Hardcoded
```

### 2. Codes validieren
```javascript
// ✅ Gut
if (regions.isValidCode(userInput)) {
  const region = regions.getByCode(userInput);
}

// ❌ Schlecht
const region = regions.getByCode(userInput); // Könnte undefined sein
```

### 3. Zentrale Konfiguration pflegen
```javascript
// Neue Region hinzufügen:
// 1. Öffne aok-regions-config.json
// 2. Füge neuen Eintrag hinzu
// 3. Fertig! Alle Scripts verwenden automatisch die neue Region
```

## 🔄 Updates

### Region hinzufügen
1. Öffne `aok-regions-config.json`
2. Füge neuen Eintrag hinzu:
```json
{
  "code": "NEU",
  "name": "Neue Region",
  "plz": "12345",
  "city": "Neustadt"
}
```
3. Fertig! Alle Scripts erkennen die neue Region automatisch

### Region ändern
1. Öffne `aok-regions-config.json`
2. Ändere die gewünschten Werte
3. Speichern - fertig!

## 📦 Dateien-Übersicht

```
aok-regions-config.json          ← Zentrale Konfiguration (JSON)
aok-regions.js                   ← JavaScript-Modul
aok-regions.md                   ← Markdown-Export
aok-sitemap-generator-v2.js      ← Generator mit Regions-Support
example-usage.js                 ← Verwendungsbeispiele
test-aok-region.js               ← Test-Script
```

## ✅ Zusammenfassung

**Sie müssen nichts manuell abspeichern!**

1. ✅ Alle Regionscodes sind in `aok-regions-config.json`
2. ✅ Das Modul `aok-regions.js` lädt sie automatisch
3. ✅ Einfache Verwendung: `const regions = getAOKRegions()`
4. ✅ Funktioniert in allen Ihren Scripts
5. ✅ Zentral wartbar und erweiterbar

**Einfach das Modul importieren und loslegen!** 🚀
