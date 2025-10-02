/**
 * AOK Regions Configuration Module
 * 
 * Zentrales Modul zur Verwaltung aller AOK-Regionscodes.
 * Kann in verschiedenen Projekten wiederverwendet werden.
 */

const fs = require('fs');
const path = require('path');

class AOKRegions {
  constructor() {
    // Lade Konfiguration aus JSON-Datei
    const configPath = path.join(__dirname, 'aok-regions-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      this.regions = config.regions;
      this.metadata = config.metadata;
    } else {
      // Fallback: Hardcoded Regionen
      this.regions = this.getDefaultRegions();
      this.metadata = {
        version: '1.0.0',
        source: 'hardcoded'
      };
    }
  }

  /**
   * Standard-Regionen (Fallback wenn JSON nicht existiert)
   */
  getDefaultRegions() {
    return [
      { code: 'BAY', name: 'Bayern', plz: '80331', city: 'München' },
      { code: 'BW', name: 'Baden-Württemberg', plz: '70173', city: 'Stuttgart' },
      { code: 'NO', name: 'Nordost', plz: '10115', city: 'Berlin' },
      { code: 'NW', name: 'Nordwest', plz: '44135', city: 'Dortmund' },
      { code: 'HE', name: 'Hessen', plz: '60311', city: 'Frankfurt' },
      { code: 'RH', name: 'Rheinland-Hamburg', plz: '50667', city: 'Köln' },
      { code: 'RP', name: 'Rheinland-Pfalz-Saarland', plz: '55116', city: 'Mainz' },
      { code: 'SA', name: 'Sachsen-Anhalt', plz: '39104', city: 'Magdeburg' },
      { code: 'NI', name: 'Niedersachsen', plz: '30159', city: 'Hannover' },
      { code: 'PL', name: 'PLUS', plz: '01067', city: 'Dresden' },
      { code: 'BR', name: 'Bremen-Bremerhaven', plz: '28195', city: 'Bremen' }
    ];
  }

  /**
   * Gibt alle Regionen zurück
   */
  getAllRegions() {
    return this.regions;
  }

  /**
   * Gibt nur Regionen mit PLZ zurück (ohne Universal)
   */
  getRegionsWithPLZ() {
    return this.regions.filter(r => r.plz !== null);
  }

  /**
   * Findet Region anhand des Codes
   */
  getByCode(code) {
    return this.regions.find(r => r.code === code.toUpperCase());
  }

  /**
   * Findet Region anhand des Namens
   */
  getByName(name) {
    return this.regions.find(r => 
      r.name.toLowerCase() === name.toLowerCase() ||
      r.fullName?.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Findet Region anhand der PLZ
   * Hinweis: Dies ist eine vereinfachte Zuordnung basierend auf Beispiel-PLZ
   * In der Realität müsste man die genauen PLZ-Bereiche prüfen
   */
  getByPLZ(plz) {
    // Vereinfachte Logik: Finde Region mit ähnlicher PLZ
    const plzNumber = parseInt(plz);
    
    // PLZ-Bereiche (vereinfacht)
    const plzRanges = {
      'BAY': [80000, 96999], // Bayern
      'BW': [68000, 79999], // Baden-Württemberg
      'NO': [10000, 19999], // Berlin, Brandenburg
      'NW': [20000, 29999, 40000, 49999], // Hamburg, Schleswig-Holstein, NRW-West
      'HE': [60000, 65999], // Hessen
      'RH': [50000, 59999], // Rheinland
      'RP': [55000, 57999, 66000, 67999], // Rheinland-Pfalz, Saarland
      'SA': [38000, 39999], // Sachsen-Anhalt
      'NI': [30000, 37999], // Niedersachsen
      'PL': [1000, 9999, 98000, 99999], // Sachsen, Thüringen
      'BR': [28000, 28999] // Bremen
    };

    for (const [code, ranges] of Object.entries(plzRanges)) {
      if (Array.isArray(ranges[0])) {
        // Mehrere Bereiche
        for (let i = 0; i < ranges.length; i += 2) {
          if (plzNumber >= ranges[i] && plzNumber <= ranges[i + 1]) {
            return this.getByCode(code);
          }
        }
      } else {
        // Einzelner Bereich
        if (plzNumber >= ranges[0] && plzNumber <= ranges[1]) {
          return this.getByCode(code);
        }
      }
    }

    return null; // Keine passende Region gefunden
  }

  /**
   * Gibt alle Regionscodes zurück
   */
  getAllCodes() {
    return this.regions.map(r => r.code);
  }

  /**
   * Gibt alle Regionen als Map zurück (Code -> Region)
   */
  getAsMap() {
    const map = new Map();
    this.regions.forEach(r => map.set(r.code, r));
    return map;
  }

  /**
   * Validiert ob ein Code existiert
   */
  isValidCode(code) {
    return this.regions.some(r => r.code === code.toUpperCase());
  }

  /**
   * Gibt Statistiken zurück
   */
  getStats() {
    return {
      totalRegions: this.regions.length,
      regionsWithPLZ: this.regions.filter(r => r.plz !== null).length,
      codes: this.getAllCodes(),
      version: this.metadata?.version || 'unknown'
    };
  }

  /**
   * Exportiert Regionen in verschiedenen Formaten
   */
  export(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(this.regions, null, 2);
      
      case 'csv':
        const headers = 'Code,Name,PLZ,City,Description';
        const rows = this.regions.map(r => 
          `${r.code},${r.name},${r.plz || ''},${r.city || ''},${r.description || ''}`
        );
        return [headers, ...rows].join('\n');
      
      case 'markdown':
        let md = '# AOK Regionen\n\n';
        md += '| Code | Name | PLZ | Stadt | Beschreibung |\n';
        md += '|------|------|-----|-------|-------------|\n';
        this.regions.forEach(r => {
          md += `| ${r.code} | ${r.name} | ${r.plz || '-'} | ${r.city || '-'} | ${r.description || '-'} |\n`;
        });
        return md;
      
      case 'array':
        return this.regions;
      
      default:
        throw new Error(`Unbekanntes Format: ${format}`);
    }
  }

  /**
   * Speichert Konfiguration in Datei
   */
  saveToFile(filepath, format = 'json') {
    const content = this.export(format);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ Regionen gespeichert: ${filepath}`);
  }

  /**
   * Gibt eine formatierte Übersicht aus
   */
  printOverview() {
    console.log('\n📍 AOK REGIONEN ÜBERSICHT\n');
    console.log('Code | Name                      | PLZ   | Stadt');
    console.log('-----|---------------------------|-------|------------------');
    
    this.regions.forEach(r => {
      const name = r.name.padEnd(25);
      const plz = (r.plz || '-').padEnd(5);
      const city = r.city || '-';
      console.log(`${r.code}  | ${name} | ${plz} | ${city}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`Gesamt: ${this.regions.length} Regionen`);
    console.log('='.repeat(70) + '\n');
  }
}

// Singleton-Instanz
let instance = null;

/**
 * Factory-Funktion für einfachen Zugriff
 */
function getAOKRegions() {
  if (!instance) {
    instance = new AOKRegions();
  }
  return instance;
}

// CLI-Verwendung
if (require.main === module) {
  const regions = new AOKRegions();
  
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      regions.printOverview();
      break;
    
    case 'codes':
      console.log('Verfügbare Codes:', regions.getAllCodes().join(', '));
      break;
    
    case 'find':
      if (!arg) {
        console.error('❌ Bitte Code, Name oder PLZ angeben');
        process.exit(1);
      }
      
      let result = regions.getByCode(arg) || 
                   regions.getByName(arg) || 
                   regions.getByPLZ(arg);
      
      if (result) {
        console.log('✅ Region gefunden:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('❌ Keine Region gefunden für:', arg);
      }
      break;
    
    case 'export':
      const format = arg || 'json';
      const filename = `aok-regions.${format === 'markdown' ? 'md' : format}`;
      regions.saveToFile(filename, format);
      break;
    
    case 'stats':
      console.log(regions.getStats());
      break;
    
    default:
      console.log('AOK Regions Manager\n');
      console.log('Verwendung:');
      console.log('  node aok-regions.js list                 - Zeigt alle Regionen');
      console.log('  node aok-regions.js codes                - Zeigt alle Codes');
      console.log('  node aok-regions.js find <code/plz>      - Sucht Region');
      console.log('  node aok-regions.js export <format>      - Exportiert (json/csv/markdown)');
      console.log('  node aok-regions.js stats                - Zeigt Statistiken');
      console.log('\nBeispiele:');
      console.log('  node aok-regions.js find BAY');
      console.log('  node aok-regions.js find 80331');
      console.log('  node aok-regions.js export markdown');
  }
}

// Exports
module.exports = {
  AOKRegions,
  getAOKRegions
};
