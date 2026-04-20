/**
 * Report Exporter for AI Debug Suite
 * Multiple ways to export debug reports from Expo Go
 */

import { Share } from 'react-native';
import { logger } from '@/utils/logger';

export interface ExportOptions {
  data: string;
  filename?: string;
  format?: 'json' | 'text';
}

/**
 * Export via React Native Share API (works in Expo Go)
 */
export async function exportViaShare(options: ExportOptions): Promise<boolean> {
  try {
    const { data, filename = 'debug-report', format = 'json' } = options;
    const extension = format === 'json' ? 'json' : 'txt';
    const fullFilename = `${filename}.${extension}`;

    // For iOS, we can use Share with a file
    // For Android and general Expo Go, we'll share as text
    const shareOptions = {
      message: format === 'json' 
        ? `Debug Report: ${fullFilename}\n\n${data}`
        : data,
      title: `Share ${fullFilename}`,
    };

    const result = await Share.share(shareOptions);
    
    if (result.action === Share.sharedAction) {
      logger.info('Report shared successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Failed to share report:', error);
    return false;
  }
}

/**
 * Export to console with formatting
 */
export function exportToConsole(options: ExportOptions): void {
  const { data, filename = 'debug-report' } = options;
  
  try {
    // Parse if JSON for better formatting
    let formattedData = data;
    try {
      const parsed = JSON.parse(data);
      formattedData = JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, use as-is
    }

    // Log with clear markers
    console.log('\n' + '='.repeat(80));
    console.log(`DEBUG REPORT: ${filename}`);
    console.log('='.repeat(80));
    console.log(formattedData);
    console.log('='.repeat(80) + '\n');
    
    logger.info(`Report logged to console: ${filename}`);
  } catch (error) {
    logger.error('Failed to log report to console:', error);
  }
}

/**
 * Send to local HTTP server (for development)
 */
export async function exportToLocalServer(
  options: ExportOptions,
  serverUrl: string = 'http://localhost:3001'
): Promise<boolean> {
  try {
    const { data, filename = 'debug-report', format = 'json' } = options;
    const extension = format === 'json' ? 'json' : 'txt';
    const fullFilename = `${filename}.${extension}`;

    const response = await fetch(`${serverUrl}/debug-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: fullFilename,
        data,
        format,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      logger.info(`Report sent to local server: ${serverUrl}`);
      return true;
    } else {
      logger.warn(`Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.warn(`Failed to send to local server (${serverUrl}):`, { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * Generate a simple HTTP server script for receiving reports
 */
export function generateServerScript(): string {
  return `#!/usr/bin/env node
/**
 * Simple Debug Report Server
 * Run: node debug-server.js
 * Then use "Send to Local Server" in AI Debug Suite
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const REPORTS_DIR = path.join(__dirname, 'debug-reports');

// Create reports directory if it doesn't exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/debug-report') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const report = JSON.parse(body);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = \`\${timestamp}-\${report.filename}\`;
        const filepath = path.join(REPORTS_DIR, filename);
        
        fs.writeFileSync(filepath, report.data, 'utf8');
        
        console.log(\`✓ Report saved: \${filename}\`);
        console.log(\`  Size: \${(report.data.length / 1024).toFixed(2)} KB\`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename }));
      } catch (error) {
        console.error('Error saving report:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <html>
        <head><title>Debug Report Server</title></head>
        <body>
          <h1>Debug Report Server Running</h1>
          <p>Port: \${PORT}</p>
          <p>Reports directory: \${REPORTS_DIR}</p>
          <p>Send reports from AI Debug Suite using "Send to Local Server"</p>
        </body>
      </html>
    \`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(\`\\n🚀 Debug Report Server running on http://localhost:\${PORT}\`);
  console.log(\`📁 Reports will be saved to: \${REPORTS_DIR}\`);
  console.log(\`\\nPress Ctrl+C to stop\\n\`);
});
`;
}

/**
 * Get local IP address (for network access)
 */
export async function getLocalIP(): Promise<string | null> {
  try {
    // This is a simple approach - in a real app you might want to use
    // a library like react-native-network-info or get it from the dev server
    // For now, we'll return localhost and let the user configure
    return 'localhost';
  } catch (error) {
    logger.warn('Failed to get local IP:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Format data for different export types
 */
export function formatForExport(
  data: any,
  format: 'json' | 'text' | 'console' = 'json'
): string {
  switch (format) {
    case 'json':
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    case 'text':
      if (typeof data === 'string') return data;
      if (data && typeof data === 'object') {
        return formatObjectAsText(data);
      }
      return String(data);
    case 'console':
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    default:
      return String(data);
  }
}

function formatObjectAsText(obj: any, indent = 0): string {
  const indentStr = '  '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      result += `${indentStr}[${index}]: `;
      if (typeof item === 'object' && item !== null) {
        result += '\n' + formatObjectAsText(item, indent + 1);
      } else {
        result += String(item) + '\n';
      }
    });
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        result += `${indentStr}${key}:\n${formatObjectAsText(value, indent + 1)}`;
      } else {
        result += `${indentStr}${key}: ${String(value)}\n`;
      }
    });
  } else {
    result = String(obj);
  }

  return result;
}

