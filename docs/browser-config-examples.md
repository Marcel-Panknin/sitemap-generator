# 🎭 Browser-Tarnung Konfigurationen

## 📱 **Mobile Browser User-Agents:**

```javascript
const mobileUserAgents = {
  // iPhone Safari
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  
  // Android Chrome
  android: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  
  // iPad Safari
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
};
```

## 🖥️ **Desktop Browser User-Agents:**

```javascript
const desktopUserAgents = {
  // Chrome Windows
  chrome_win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Chrome Mac
  chrome_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Firefox Windows
  firefox_win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  
  // Safari Mac
  safari_mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
};
```

## ⚙️ **Erweiterte Crawler-Konfiguration:**

```javascript
const generator = SitemapGenerator('https://example.com', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  
  // Weitere Optionen:
  stripQuerystring: false,
  filepath: './sitemap.xml',
  maxDepth: 3,              // Maximale Crawl-Tiefe
  ignoreInvalidSSL: false,  // SSL-Zertifikate prüfen
  respectRobotsTxt: true,   // robots.txt beachten
  
  // Crawler-spezifische Einstellungen:
  interval: 2000,           // 2 Sekunden zwischen Anfragen
  maxConcurrency: 1,        // Nur eine Anfrage gleichzeitig
  timeout: 30000,           // 30 Sekunden Timeout
  
  // URL-Filter:
  allowedSchemes: ['http', 'https'],
  allowedDomains: ['example.com', 'www.example.com']
});

// Zusätzliche Crawler-Konfiguration:
const crawler = generator.getCrawler();

// Browser-ähnliche Headers
crawler.on('fetchstart', (queueItem) => {
  queueItem.requestHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
});
```

## ⚠️ **Wichtige Hinweise:**

### **Rechtliche Aspekte:**
- ✅ **Erlaubt:** Öffentlich zugängliche Inhalte crawlen
- ✅ **Erlaubt:** robots.txt und meta-tags respektieren
- ❌ **Problematisch:** AGB verletzen
- ❌ **Problematisch:** Überlastung der Server
- ❌ **Problematisch:** Urheberrechtlich geschützte Inhalte

### **Ethische Richtlinien:**
- 🐌 **Langsam crawlen** (2-5 Sekunden zwischen Anfragen)
- 🤖 **robots.txt respektieren**
- 📧 **Kontakt-Informationen** im User-Agent
- 🔄 **Nicht zu häufig** die gleiche Seite besuchen

### **Technische Tipps:**
- 🔄 **User-Agent regelmäßig aktualisieren**
- 📊 **Monitoring der Anfragen**
- 🛡️ **Proxy/VPN für zusätzliche Anonymität**
- 🕐 **Zufällige Delays** zwischen Anfragen

## 🎯 **Empfohlene Konfiguration:**

```javascript
// Ausgewogene Browser-Simulation
const generator = SitemapGenerator('https://example.com', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  stripQuerystring: false,
  respectRobotsTxt: true,
  interval: 3000,           // 3 Sekunden zwischen Anfragen
  maxConcurrency: 1,        // Einzelne Anfragen
  timeout: 30000            // 30 Sekunden Timeout
});
```