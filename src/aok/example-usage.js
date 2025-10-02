/**
 * Beispiele für die Verwendung des AOK Regions Moduls
 */

const { getAOKRegions } = require('./aok-regions.js');

// Hole Regions-Instanz
const regions = getAOKRegions();

console.log('🎯 AOK REGIONS MODULE - VERWENDUNGSBEISPIELE\n');

// ===== BEISPIEL 1: Alle Regionen abrufen =====
console.log('📋 BEISPIEL 1: Alle Regionen');
console.log('─'.repeat(50));
const allRegions = regions.getAllRegions();
console.log(`Anzahl Regionen: ${allRegions.length}`);
console.log('Erste 3 Regionen:', allRegions.slice(0, 3).map(r => r.code).join(', '));
console.log();

// ===== BEISPIEL 2: Region nach Code suchen =====
console.log('🔍 BEISPIEL 2: Region nach Code suchen');
console.log('─'.repeat(50));
const bayern = regions.getByCode('BAY');
console.log('Code: BAY →', bayern.name, '(PLZ:', bayern.plz + ')');

const bw = regions.getByCode('BW');
console.log('Code: BW  →', bw.name, '(PLZ:', bw.plz + ')');
console.log();

// ===== BEISPIEL 3: Region nach PLZ suchen =====
console.log('📮 BEISPIEL 3: Region nach PLZ suchen');
console.log('─'.repeat(50));
const region80331 = regions.getByPLZ('80331');
console.log('PLZ 80331 →', region80331?.name || 'Nicht gefunden');

const region10115 = regions.getByPLZ('10115');
console.log('PLZ 10115 →', region10115?.name || 'Nicht gefunden');

const region70173 = regions.getByPLZ('70173');
console.log('PLZ 70173 →', region70173?.name || 'Nicht gefunden');
console.log();

// ===== BEISPIEL 4: Nur Regionen mit PLZ =====
console.log('🗺️  BEISPIEL 4: Nur Regionen mit PLZ');
console.log('─'.repeat(50));
const withPLZ = regions.getRegionsWithPLZ();
console.log(`${withPLZ.length} Regionen haben eine PLZ`);
console.log('Codes:', withPLZ.map(r => r.code).join(', '));
console.log();

// ===== BEISPIEL 5: Code-Validierung =====
console.log('✅ BEISPIEL 5: Code-Validierung');
console.log('─'.repeat(50));
console.log('Ist "BAY" gültig?', regions.isValidCode('BAY'));
console.log('Ist "XYZ" gültig?', regions.isValidCode('XYZ'));
console.log('Ist "bay" gültig?', regions.isValidCode('bay')); // Case-insensitive
console.log();

// ===== BEISPIEL 6: Alle Codes abrufen =====
console.log('📝 BEISPIEL 6: Alle Codes');
console.log('─'.repeat(50));
const codes = regions.getAllCodes();
console.log('Codes:', codes.join(', '));
console.log();

// ===== BEISPIEL 7: Als Map verwenden =====
console.log('🗂️  BEISPIEL 7: Als Map verwenden');
console.log('─'.repeat(50));
const regionMap = regions.getAsMap();
console.log('Map-Größe:', regionMap.size);
console.log('Bayern aus Map:', regionMap.get('BAY').name);
console.log();

// ===== BEISPIEL 8: Statistiken =====
console.log('📊 BEISPIEL 8: Statistiken');
console.log('─'.repeat(50));
const stats = regions.getStats();
console.log(JSON.stringify(stats, null, 2));
console.log();

// ===== BEISPIEL 9: Export in verschiedenen Formaten =====
console.log('💾 BEISPIEL 9: Export');
console.log('─'.repeat(50));

// JSON Export
const jsonExport = regions.export('json');
console.log('JSON Export (erste 100 Zeichen):');
console.log(jsonExport.substring(0, 100) + '...');
console.log();

// CSV Export
const csvExport = regions.export('csv');
console.log('CSV Export (erste 2 Zeilen):');
console.log(csvExport.split('\n').slice(0, 2).join('\n'));
console.log();

// ===== BEISPIEL 10: Verwendung in Schleife =====
console.log('🔄 BEISPIEL 10: Iteration über alle Regionen');
console.log('─'.repeat(50));
regions.getAllRegions().forEach((region, index) => {
  if (index < 3) { // Nur erste 3 zeigen
    console.log(`${index + 1}. ${region.code} - ${region.name} (${region.plz || 'keine PLZ'})`);
  }
});
console.log('... und weitere', regions.getAllRegions().length - 3, 'Regionen');
console.log();

// ===== BEISPIEL 11: Integration in Sitemap-Generator =====
console.log('🚀 BEISPIEL 11: Integration in Sitemap-Generator');
console.log('─'.repeat(50));
console.log('// Beispiel-Code:');
console.log(`
const { getAOKRegions } = require('./aok-regions.js');
const regions = getAOKRegions();

// Generiere Sitemaps für alle Regionen mit PLZ
for (const region of regions.getRegionsWithPLZ()) {
  console.log(\`Generiere Sitemap für \${region.name}...\`);
  // await generateSitemap(region.code, region.plz);
}
`);

console.log('✅ Alle Beispiele abgeschlossen!\n');
