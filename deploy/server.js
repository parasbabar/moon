/**
 * 🌙 Simple HTTP Server for Lace Wallet Connection
 * Must serve from http://localhost for browser extensions to work.
 * ES Module version
 */

import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.substring(0, __filename.lastIndexOf('\\'));
const PORT = 8080;
const DIRECTORY = __dirname;

function getMimeType(ext) {
    const types = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.txt': 'text/plain'
    };
    return types[ext] || 'application/octet-stream';
}

async function serveFile(filePath, stats, res) {
    const ext = extname(filePath);
    const mimeType = getMimeType(ext);
    
    res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stats.size
    });
    
    const stream = createReadStream(filePath);
    stream.pipe(res);
}

const server = createServer(async (req, res) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = join(DIRECTORY, filePath);
    
    // Security check: don't allow directory traversal
    if (!filePath.startsWith(DIRECTORY)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
            await serveFile(filePath, stats, res);
            return;
        }
        
        // Try index.html for directory requests
        if (req.url.endsWith('/')) {
            const indexPath = join(DIRECTORY, req.url, 'index.html');
            const indexStats = await stat(indexPath);
            if (indexStats.isFile()) {
                await serveFile(indexPath, indexStats, res);
                return;
            }
        }
        
        res.writeHead(404);
        res.end('Not Found');
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            console.error('Server error:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

server.listen(PORT, () => {
    console.log('🌙 Serving Lace wallet test server at http://localhost:' + PORT);
    console.log('📁 Directory: ' + DIRECTORY);
    console.log('\nAvailable test pages:');
    console.log('1. http://localhost:8080/test-exact-api.html - Exact API test');
    console.log('2. http://localhost:8080/test-minimal.html - Minimal test');
    console.log('3. http://localhost:8080/diagnose.html - Full diagnostic');
    console.log('4. http://localhost:8080/index.html - Deployment UI');
    console.log('\n⚠️ IMPORTANT: Browser extensions often require http://localhost origin');
    console.log('   file:// URLs may not have access to Lace wallet extension');
    console.log('\n✅ Server started. Press Ctrl+C to stop.');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port:`);
        console.error('  node server.js 8081');
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});