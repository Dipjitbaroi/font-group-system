const http = require('http');
const path = require('path');
const fs = require('fs');
const { parse } = require('querystring');

// SOLID Principle: Dependency Inversion - Service abstractions
class FontService {
  constructor() {
    this.uploadsDir = path.join(__dirname, 'uploads', 'fonts');
    this.ensureUploadsDirectory();
  }

  ensureUploadsDirectory() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  getAllFonts() {
    try {
      const files = fs.readdirSync(this.uploadsDir);
      return files
        .filter(file => file.endsWith('.ttf'))
        .map(file => ({
          id: file.replace('.ttf', ''),
          name: file.replace('.ttf', ''),
          filename: file,
          path: `/uploads/fonts/${file}`
        }));
    } catch (error) {
      console.error('Error reading fonts directory:', error);
      return [];
    }
  }

  deleteFont(filename) {
    try {
      const filePath = path.join(this.uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting font:', error);
      return false;
    }
  }
}

class GroupService {
  constructor() {
    this.dataFile = path.join(__dirname, 'data', 'groups.json');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify([]));
    }
  }

  getAllGroups() {
    try {
      const data = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading groups:', error);
      return [];
    }
  }

  createGroup(group) {
    try {
      const groups = this.getAllGroups();
      const newGroup = {
        id: Date.now().toString(),
        ...group,
        createdAt: new Date().toISOString()
      };
      groups.push(newGroup);
      fs.writeFileSync(this.dataFile, JSON.stringify(groups, null, 2));
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }

  updateGroup(id, updatedGroup) {
    try {
      const groups = this.getAllGroups();
      const index = groups.findIndex(group => group.id === id);
      if (index !== -1) {
        groups[index] = { ...groups[index], ...updatedGroup, updatedAt: new Date().toISOString() };
        fs.writeFileSync(this.dataFile, JSON.stringify(groups, null, 2));
        return groups[index];
      }
      return null;
    } catch (error) {
      console.error('Error updating group:', error);
      return null;
    }
  }

  deleteGroup(id) {
    try {
      const groups = this.getAllGroups();
      const filteredGroups = groups.filter(group => group.id !== id);
      fs.writeFileSync(this.dataFile, JSON.stringify(filteredGroups, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      return false;
    }
  }
}

// SOLID Principle: Single Responsibility - Validation service
class ValidationService {
  static validateTTFFile(file) {
    return file && file.mimetype === 'font/ttf' || file.originalname.toLowerCase().endsWith('.ttf');
  }

  static validateGroup(group) {
    return group.title && 
           group.fonts && 
           Array.isArray(group.fonts) && 
           group.fonts.length >= 2;
  }
}

// Initialize services
const fontService = new FontService();
const groupService = new GroupService();

const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    const { url, method } = req;

    // API Routes
    if (url.startsWith('/api/')) {
        if (url === '/api/fonts' && method === 'GET') {
            try {
                const fonts = fontService.getAllFonts();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(fonts));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch fonts' }));
            }
        } else if (url === '/api/fonts/upload' && method === 'POST') {
            let body = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body);
                // This is a simplified parser for multipart/form-data.
                // A more robust solution would be needed for production.
                const boundary = req.headers['content-type'].split('; ')[1].replace('boundary=', '');
                const parts = body.toString().split(boundary).slice(1, -1);
                const filePart = parts[0];
                const contentDisposition = filePart.match(/Content-Disposition: form-data; name="font"; filename="(.+?)"/);
                if (contentDisposition) {
                    const filename = contentDisposition[1];
                    const fileContent = filePart.split('\r\n\r\n')[1];
                    const filePath = path.join(fontService.uploadsDir, filename);
                    fs.writeFileSync(filePath, fileContent, 'binary');
                    const font = {
                        id: filename.replace('.ttf', ''),
                        name: filename.replace('.ttf', ''),
                        filename: filename,
                        path: `/uploads/fonts/${filename}`
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(font));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid file upload' }));
                }
            });
        } else if (url.startsWith('/api/fonts/') && method === 'DELETE') {
            const filename = url.split('/')[3];
            try {
                const success = fontService.deleteFont(filename);
                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Font deleted successfully' }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Font not found' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete font' }));
            }
        } else if (url === '/api/groups' && method === 'GET') {
            try {
                const groups = groupService.getAllGroups();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(groups));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch groups' }));
            }
        } else if (url === '/api/groups' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const groupData = JSON.parse(body);
                    if (!ValidationService.validateGroup(groupData)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid group data. Must have title and at least 2 fonts.' }));
                        return;
                    }
                    const group = groupService.createGroup(groupData);
                    if (group) {
                        res.writeHead(201, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(group));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to create group' }));
                    }
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to create group' }));
                }
            });
        } else if (url.startsWith('/api/groups/') && method === 'PUT') {
            const id = url.split('/')[3];
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const groupData = JSON.parse(body);
                    if (!ValidationService.validateGroup(groupData)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid group data. Must have title and at least 2 fonts.' }));
                        return;
                    }
                    const group = groupService.updateGroup(id, groupData);
                    if (group) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(group));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Group not found' }));
                    }
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update group' }));
                }
            });
        } else if (url.startsWith('/api/groups/') && method === 'DELETE') {
            const id = url.split('/')[3];
            try {
                const success = groupService.deleteGroup(id);
                if (success) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Group deleted successfully' }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Group not found' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete group' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } else {
        // Static file serving
        let filePath = path.join(__dirname, url);
        if (url === '/') {
            filePath = path.join(__dirname, 'client/build', 'index.html');
        } else if (url.startsWith('/uploads/')) {
            filePath = path.join(__dirname, url);
        } else {
            filePath = path.join(__dirname, 'client/build', url);
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.wasm': 'application/wasm'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if(error.code == 'ENOENT'){
                    // If file not found, serve index.html for client-side routing
                    fs.readFile(path.join(__dirname, 'client/build', 'index.html'), (err, cont) => {
                        if (err) {
                            res.writeHead(500);
                            res.end('Sorry, check with the site admin for error: '+err.code+' ..\n');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(cont, 'utf-8');
                        }
                    });
                }
                else {
                    res.writeHead(500);
                    res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
