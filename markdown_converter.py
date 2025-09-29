#!/usr/bin/env python3
"""
🌑 Dementor Markdown Converter
Converts all URLs from a Dementor-generated sitemap to LLM-ready Markdown files.

Usage:
    python3 markdown_converter.py --sitemap dementor-sitemap.xml --output ./markdown-output
"""

import argparse
import json
import os
import re
import time
import random
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, urljoin
from typing import List, Dict, Optional

from bs4 import BeautifulSoup
from markdownify import markdownify as md


class DementorHTMLFetcher:
    """Fetches HTML using Dementor's cURL-based anti-bot techniques"""
    
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
        ]
        self.accept_languages = [
            'de-DE,de;q=0.9,en;q=0.8',
            'en-US,en;q=0.9',
            'fr-FR,fr;q=0.9,en;q=0.8',
            'es-ES,es;q=0.9,en;q=0.8'
        ]
    
    def fetch_html(self, url: str) -> Optional[str]:
        """Fetches HTML using cURL with Dementor's anti-bot techniques"""
        try:
            # Select random user agent and accept language
            current_user_agent = random.choice(self.user_agents)
            random_accept_language = random.choice(self.accept_languages)
            
            print(f"  🌐 Enhanced cURL Attack: {url}")
            print(f"  🕵️ User-Agent: {current_user_agent}")
            
            # Human-like delay before request
            delay = random.uniform(0.5, 1.5)
            print(f"  ⏳ Waiting {delay:.1f}s before request...")
            time.sleep(delay)
            
            # Build cURL command exactly like dementor.js
            curl_command = [
                'curl',
                '-s',
                '-L',
                '-H', f'User-Agent: {current_user_agent}',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                '-H', f'Accept-Language: {random_accept_language}',
                '-H', 'Accept-Encoding: gzip, deflate, br',
                '-H', 'DNT: 1',
                '-H', 'Connection: keep-alive',
                '-H', 'Upgrade-Insecure-Requests: 1',
                '-H', 'Sec-Fetch-Dest: document',
                '-H', 'Sec-Fetch-Mode: navigate',
                '-H', 'Sec-Fetch-Site: none',
                '-H', 'Cache-Control: max-age=0',
                '--compressed',
                '--max-time', '30',
                '--connect-timeout', '10',
                '--retry', '3',
                '--retry-delay', '2',
                url
            ]
            
            # Execute cURL command
            result = subprocess.run(
                curl_command,
                capture_output=True,
                text=True,
                timeout=35  # Slightly longer than curl's max-time
            )
            
            if result.returncode == 0 and result.stdout and len(result.stdout) > 0:
                print(f"  ✅ Success: {len(result.stdout)} bytes")
                return result.stdout
            else:
                error_msg = result.stderr if result.stderr else f"Empty response (return code: {result.returncode})"
                print(f"  ❌ cURL failed: {error_msg}")
                return None
                
        except subprocess.TimeoutExpired:
            print(f"  ❌ Timeout fetching {url}")
            return None
        except Exception as e:
            print(f"  ❌ Failed to fetch {url}: {e}")
            return None


class HTMLCleaner:
    """Cleans HTML for optimal LLM processing"""
    
    def __init__(self):
        self.unwanted_tags = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            'advertisement', 'banner', 'cookie', 'popup', 'modal',
            'iframe', 'embed', 'object', 'applet', 'form', 'input',
            'button', 'select', 'textarea', 'noscript'
        ]
        
        self.unwanted_classes = [
            'ad', 'ads', 'advertisement', 'banner', 'popup', 'modal',
            'navigation', 'nav', 'sidebar', 'footer', 'header',
            'menu', 'breadcrumb', 'social', 'share', 'comment',
            'cookie', 'gdpr', 'newsletter', 'subscription'
        ]
        
        self.unwanted_ids = [
            'header', 'footer', 'nav', 'navigation', 'sidebar',
            'menu', 'ads', 'advertisement', 'social', 'comments'
        ]
    
    def clean_html(self, html: str) -> str:
        """Cleans HTML for optimal LLM processing"""
        soup = BeautifulSoup(html, 'lxml')
        
        # 1. Remove unwanted tags completely
        for tag in self.unwanted_tags:
            for element in soup.find_all(tag):
                element.decompose()
        
        # 2. Remove elements with unwanted classes
        for class_name in self.unwanted_classes:
            for element in soup.find_all(class_=lambda x: x and any(
                class_name.lower() in cls.lower() for cls in x
            )):
                element.decompose()
        
        # 3. Remove elements with unwanted IDs
        for id_name in self.unwanted_ids:
            for element in soup.find_all(id=lambda x: x and id_name.lower() in x.lower()):
                element.decompose()
        
        # 4. Extract main content
        main_content = self.extract_main_content(soup)
        
        # 5. Clean up attributes
        self.clean_attributes(main_content)
        
        return str(main_content)
    
    def extract_main_content(self, soup: BeautifulSoup) -> BeautifulSoup:
        """Finds and extracts the main content of the page"""
        # Priority order for main content
        selectors = [
            'main',
            'article',
            '[role="main"]',
            '.main-content',
            '.content',
            '.post-content',
            '.entry-content',
            '#main',
            '#content'
        ]
        
        for selector in selectors:
            main = soup.select_one(selector)
            if main and len(main.get_text().strip()) > 100:
                return main
        
        # Fallback: Find the div with most text content
        divs = soup.find_all('div')
        if divs:
            main_div = max(divs, key=lambda div: len(div.get_text()))
            if len(main_div.get_text().strip()) > 100:
                return main_div
        
        # Last resort: return body
        return soup.body or soup
    
    def clean_attributes(self, element):
        """Removes unnecessary attributes from elements"""
        allowed_attrs = {
            'a': ['href', 'title'],
            'img': ['src', 'alt', 'title'],
            'table': [],
            'th': [],
            'td': [],
            'tr': [],
            'thead': [],
            'tbody': [],
            'tfoot': []
        }
        
        for tag in element.find_all():
            if tag.name in allowed_attrs:
                # Keep only allowed attributes
                attrs_to_keep = allowed_attrs[tag.name]
                tag.attrs = {k: v for k, v in tag.attrs.items() if k in attrs_to_keep}
            else:
                # Remove all attributes for other tags
                tag.attrs = {}


class MarkdownConverter:
    """Converts cleaned HTML to LLM-ready Markdown"""
    
    def __init__(self):
        self.options = {
            'heading_style': 'ATX',          # # Überschriften
            'bullets': '-',                  # - Listen
            'escape_asterisks': False,       # Für LLMs optimiert
            'escape_underscores': False,
            'wrap': True,
            'wrap_width': 80
        }
    
    def convert_to_markdown(self, clean_html: str, url: str) -> str:
        """Converts cleaned HTML to LLM-ready Markdown"""
        # Extract title
        title = self.extract_title(clean_html)
        
        # Convert to markdown
        markdown = md(clean_html, **self.options)
        
        # Clean up markdown
        markdown = self.clean_markdown(markdown)
        
        # Add header with metadata
        header = f"""# {title}

**Source URL:** {url}
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Domain:** {urlparse(url).netloc}

---

"""
        
        return header + markdown
    
    def extract_title(self, html: str) -> str:
        """Extracts title from HTML"""
        soup = BeautifulSoup(html, 'lxml')
        
        # Try different title sources
        title_sources = [
            soup.find('title'),
            soup.find('h1'),
            soup.find('h2'),
            soup.find('[property="og:title"]'),
            soup.find('[name="twitter:title"]')
        ]
        
        for source in title_sources:
            if source:
                title = source.get('content') if source.get('content') else source.get_text()
                if title and title.strip():
                    return title.strip()[:100]  # Limit title length
        
        return "Untitled Page"
    
    def clean_markdown(self, markdown: str) -> str:
        """Cleans up the generated markdown"""
        # Remove excessive whitespace
        markdown = re.sub(r'\n\s*\n\s*\n', '\n\n', markdown)
        
        # Remove empty links
        markdown = re.sub(r'\[\s*\]\([^)]*\)', '', markdown)
        
        # Clean up list formatting
        markdown = re.sub(r'\n\s*-\s*\n', '\n', markdown)
        
        # Remove trailing whitespace
        lines = [line.rstrip() for line in markdown.split('\n')]
        markdown = '\n'.join(lines)
        
        return markdown.strip()


class FileManager:
    """Manages file operations for markdown output"""
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.metadata = {
            'generated_at': datetime.now().isoformat(),
            'files': [],
            'stats': {
                'total_urls': 0,
                'successful': 0,
                'failed': 0
            }
        }
    
    def url_to_filename(self, url: str) -> str:
        """Converts URL to a safe filename"""
        parsed = urlparse(url)
        
        # Create base filename from domain and path
        domain = parsed.netloc.replace('www.', '').replace('.', '-')
        path = parsed.path.strip('/').replace('/', '-')
        
        if not path or path == '-':
            filename = f"{domain}-index"
        else:
            filename = f"{domain}-{path}"
        
        # Clean filename
        filename = re.sub(r'[^\w\-_]', '-', filename)
        filename = re.sub(r'-+', '-', filename)
        filename = filename.strip('-')
        
        # Ensure unique filename
        base_filename = filename
        counter = 1
        while (self.output_dir / f"{filename}.md").exists():
            filename = f"{base_filename}-{counter}"
            counter += 1
        
        return f"{filename}.md"
    
    def save_markdown(self, content: str, url: str) -> str:
        """Saves markdown content to file"""
        filename = self.url_to_filename(url)
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Update metadata
        self.metadata['files'].append({
            'filename': filename,
            'url': url,
            'size': len(content),
            'created_at': datetime.now().isoformat()
        })
        
        return str(filepath)
    
    def save_metadata(self):
        """Saves metadata to JSON file"""
        metadata_path = self.output_dir / 'metadata.json'
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False)


class SitemapParser:
    """Parses Dementor-generated sitemaps"""
    
    @staticmethod
    def parse_sitemap(sitemap_file: str) -> List[str]:
        """Extracts all URLs from the Dementor-generated sitemap"""
        try:
            tree = ET.parse(sitemap_file)
            root = tree.getroot()
            
            urls = []
            # Handle namespace
            namespace = {'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            for url_elem in root.findall('.//sitemap:loc', namespace):
                urls.append(url_elem.text)
            
            # Fallback without namespace
            if not urls:
                for url_elem in root.findall('.//loc'):
                    urls.append(url_elem.text)
            
            return urls
            
        except ET.ParseError as e:
            print(f"❌ Error parsing sitemap: {e}")
            return []


class DementorMarkdownConverter:
    """Main converter class that orchestrates the conversion process"""
    
    def __init__(self, output_dir: str = './markdown-output'):
        self.fetcher = DementorHTMLFetcher()
        self.cleaner = HTMLCleaner()
        self.converter = MarkdownConverter()
        self.file_manager = FileManager(output_dir)
    
    def convert_sitemap(self, sitemap_file: str):
        """Converts all URLs from sitemap to markdown files"""
        print(f"🌑 DEMENTOR MARKDOWN CONVERTER")
        print(f"📄 Sitemap: {sitemap_file}")
        print(f"📁 Output: {self.file_manager.output_dir}")
        print()
        
        # Parse sitemap
        urls = SitemapParser.parse_sitemap(sitemap_file)
        if not urls:
            print("❌ No URLs found in sitemap!")
            return
        
        print(f"🔍 Found {len(urls)} URLs to process")
        self.file_manager.metadata['stats']['total_urls'] = len(urls)
        print()
        
        # Process each URL
        for i, url in enumerate(urls, 1):
            print(f"📄 Processing {i}/{len(urls)}: {url}")
            
            try:
                # Fetch HTML
                html = self.fetcher.fetch_html(url)
                if not html:
                    self.file_manager.metadata['stats']['failed'] += 1
                    continue
                
                # Clean HTML
                print(f"  🧹 Cleaning HTML...")
                clean_html = self.cleaner.clean_html(html)
                
                # Convert to Markdown
                print(f"  📝 Converting to Markdown...")
                markdown = self.converter.convert_to_markdown(clean_html, url)
                
                # Save file
                filepath = self.file_manager.save_markdown(markdown, url)
                print(f"  ✅ Saved: {filepath}")
                
                self.file_manager.metadata['stats']['successful'] += 1
                
            except Exception as e:
                print(f"  ❌ Error processing {url}: {e}")
                self.file_manager.metadata['stats']['failed'] += 1
            
            print()
        
        # Save metadata
        self.file_manager.save_metadata()
        
        # Print summary
        stats = self.file_manager.metadata['stats']
        print(f"🎉 CONVERSION COMPLETE!")
        print(f"📊 Total URLs: {stats['total_urls']}")
        print(f"✅ Successful: {stats['successful']}")
        print(f"❌ Failed: {stats['failed']}")
        print(f"📁 Output directory: {self.file_manager.output_dir}")


def main():
    parser = argparse.ArgumentParser(description='Convert Dementor sitemap to LLM-ready Markdown files')
    parser.add_argument('--sitemap', required=True, help='Path to the Dementor-generated sitemap XML file')
    parser.add_argument('--output', default='./markdown-output', help='Output directory for markdown files')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.sitemap):
        print(f"❌ Sitemap file not found: {args.sitemap}")
        return 1
    
    converter = DementorMarkdownConverter(args.output)
    converter.convert_sitemap(args.sitemap)
    
    return 0


if __name__ == '__main__':
    exit(main())