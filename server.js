const http = require("http");
const path = require("path");
const fs = require("fs");
const { parse } = require("querystring");

// ✅ ADDED: Font validation utilities
class FontValidator {
  static isValidTTFFile(buffer) {
    if (!buffer || buffer.length < 100) return false;
    
    // Check TTF signature
    const signature = buffer.readUInt32BE(0);
    const validSignatures = [
      0x00010000, // TrueType
      0x74727565, // 'true' (TrueType)
      0x4F54544F, // 'OTTO' (OpenType with CFF)
      0x74746366, // 'ttcf' (TrueType Collection)
    ];
    
    return validSignatures.includes(signature);
  }
  
  static validateFileSize(buffer) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    return buffer.length <= maxSize;
  }
  
  static sanitizeFilename(filename) {
    // Remove dangerous characters and ensure .ttf extension
    const sanitized = filename
      .replace(/[^a-zA-Z0-9\-_.]/g, '')
      .replace(/\.+/g, '.');
    
    if (!sanitized.toLowerCase().endsWith('.ttf')) {
      return sanitized.replace(/\.[^.]*$/, '') + '.ttf';
    }
    
    return sanitized;
  }
}

// SOLID Principle: Dependency Inversion - Service abstractions
class FontService {
  constructor() {
    this.uploadsDir = path.join(__dirname, "uploads", "fonts");
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
        .filter((file) => file.endsWith(".ttf"))
        .map((file) => ({
          id: file.replace(".ttf", ""),
          name: file.replace(".ttf", ""),
          filename: file,
          path: `/uploads/fonts/${file}`,
        }));
    } catch (error) {
      console.error("Error reading fonts directory:", error);
      return [];
    }
  }

  // ✅ IMPROVED: Better font file handling
  async saveFont(filename, fileBuffer) {
    try {
      // Validate file
      if (!FontValidator.isValidTTFFile(fileBuffer)) {
        throw new Error('Invalid TTF file format');
      }
      
      if (!FontValidator.validateFileSize(fileBuffer)) {
        throw new Error('Font file is too large (max 10MB)');
      }
      
      // Sanitize filename
      const sanitizedFilename = FontValidator.sanitizeFilename(filename);
      const filePath = path.join(this.uploadsDir, sanitizedFilename);
      
      // Check if file already exists
      if (fs.existsSync(filePath)) {
        throw new Error('Font file already exists');
      }
      
      // Write file
      fs.writeFileSync(filePath, fileBuffer);
      
      return {
        id: sanitizedFilename.replace(".ttf", ""),
        name: sanitizedFilename.replace(".ttf", ""),
        filename: sanitizedFilename,
        path: `/uploads/fonts/${sanitizedFilename}`,
      };
    } catch (error) {
      console.error("Error saving font:", error);
      throw error;
    }
  }

  deleteFont(filename) {
    try {
      const sanitizedFilename = FontValidator.sanitizeFilename(filename);
      const filePath = path.join(this.uploadsDir, sanitizedFilename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error deleting font:", error);
      return false;
    }
  }
}

class GroupService {
  constructor() {
    this.dataFile = path.join(__dirname, "data", "groups.json");
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
      const data = fs.readFileSync(this.dataFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error reading groups:", error);
      return [];
    }
  }

  createGroup(group) {
    try {
      const groups = this.getAllGroups();
      const newGroup = {
        id: Date.now().toString(),
        ...group,
        createdAt: new Date().toISOString(),
      };
      groups.push(newGroup);
      fs.writeFileSync(this.dataFile, JSON.stringify(groups, null, 2));
      return newGroup;
    } catch (error) {
      console.error("Error creating group:", error);
      return null;
    }
  }

  updateGroup(id, updatedGroup) {
    try {
      const groups = this.getAllGroups();
      const index = groups.findIndex((group) => group.id === id);
      if (index !== -1) {
        groups[index] = {
          ...groups[index],
          ...updatedGroup,
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(this.dataFile, JSON.stringify(groups, null, 2));
        return groups[index];
      }
      return null;
    } catch (error) {
      console.error("Error updating group:", error);
      return null;
    }
  }

  deleteGroup(id) {
    try {
      const groups = this.getAllGroups();
      const filteredGroups = groups.filter((group) => group.id !== id);
      fs.writeFileSync(this.dataFile, JSON.stringify(filteredGroups, null, 2));
      return true;
    } catch (error) {
      console.error("Error deleting group:", error);
      return false;
    }
  }
}

// SOLID Principle: Single Responsibility - Validation service
class ValidationService {
  static validateTTFFile(file) {
    return (
      (file && file.mimetype === "font/ttf") ||
      file.originalname.toLowerCase().endsWith(".ttf")
    );
  }

  static validateGroup(group) {
    return (
      group.title &&
      group.fonts &&
      Array.isArray(group.fonts) &&
      group.fonts.length >= 2
    );
  }
}

// ✅ IMPROVED: Multipart form parser with better error handling
class MultipartParser {
  static parse(body, boundary) {
    try {
      const parts = body.toString('binary').split(`--${boundary}`);
      const result = {};
      
      for (let part of parts) {
        if (part.includes('Content-Disposition')) {
          const lines = part.split('\r\n');
          let contentDisposition = lines.find(line => line.includes('Content-Disposition'));
          
          if (contentDisposition) {
            const nameMatch = contentDisposition.match(/name="([^"]+)"/);
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            
            if (nameMatch && filenameMatch) {
              const fieldName = nameMatch[1];
              const filename = filenameMatch[1];
              
              // Find content start
              const contentStart = part.indexOf('\r\n\r\n') + 4;
              const contentEnd = part.lastIndexOf('\r\n');
              
              if (contentStart < contentEnd) {
                const content = part.slice(contentStart, contentEnd);
                result[fieldName] = {
                  filename: filename,
                  data: Buffer.from(content, 'binary')
                };
              }
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Multipart parsing error:', error);
      return null;
    }
  }
}

// Initialize services
const fontService = new FontService();
const groupService = new GroupService();

const server = http.createServer((req, res) => {
  // ✅ IMPROVED: CORS Headers with better configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const { url, method } = req;

  // ✅ ADDED: Request logging
  console.log(`${new Date().toISOString()} - ${method} ${url}`);

  // API Routes
  if (url.startsWith("/api/")) {
    if (url === "/api/fonts" && method === "GET") {
      try {
        const fonts = fontService.getAllFonts();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fonts));
      } catch (error) {
        console.error("Error fetching fonts:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch fonts" }));
      }
    } else if (url === "/api/fonts/upload" && method === "POST") {
      let body = [];
      
      req
        .on("data", (chunk) => {
          body.push(chunk);
        })
        .on("end", async () => {
          try {
            body = Buffer.concat(body);
            
            // ✅ IMPROVED: Better multipart parsing
            const contentType = req.headers["content-type"];
            if (!contentType || !contentType.includes("multipart/form-data")) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid content type" }));
              return;
            }
            
            const boundary = contentType.split("boundary=")[1];
            if (!boundary) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid boundary" }));
              return;
            }
            
            const parsed = MultipartParser.parse(body, boundary);
            if (!parsed || !parsed.font) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "No font file found" }));
              return;
            }
            
            const { filename, data } = parsed.font;
            
            // Save font with validation
            const fontResult = await fontService.saveFont(filename, data);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(fontResult));
            
          } catch (error) {
            console.error("Font upload error:", error);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: error.message || "Invalid file upload" }));
          }
        })
        .on("error", (error) => {
          console.error("Upload stream error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Upload failed" }));
        });
        
    } else if (url.startsWith("/api/fonts/") && method === "DELETE") {
      const filename = decodeURIComponent(url.split("/")[3]);
      try {
        const success = fontService.deleteFont(filename);
        if (success) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Font deleted successfully" }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Font not found" }));
        }
      } catch (error) {
        console.error("Font deletion error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to delete font" }));
      }
    } else if (url === "/api/groups" && method === "GET") {
      try {
        const groups = groupService.getAllGroups();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(groups));
      } catch (error) {
        console.error("Error fetching groups:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch groups" }));
      }
    } else if (url === "/api/groups" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const groupData = JSON.parse(body);
          if (!ValidationService.validateGroup(groupData)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error:
                  "Invalid group data. Must have title and at least 2 fonts.",
              })
            );
            return;
          }
          const group = groupService.createGroup(groupData);
          if (group) {
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(group));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to create group" }));
          }
        } catch (error) {
          console.error("Group creation error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to create group" }));
        }
      });
    } else if (url.startsWith("/api/groups/") && method === "PUT") {
      const id = url.split("/")[3];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const groupData = JSON.parse(body);
          if (!ValidationService.validateGroup(groupData)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error:
                  "Invalid group data. Must have title and at least 2 fonts.",
              })
            );
            return;
          }
          const group = groupService.updateGroup(id, groupData);
          if (group) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(group));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Group not found" }));
          }
        } catch (error) {
          console.error("Group update error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to update group" }));
        }
      });
    } else if (url.startsWith("/api/groups/") && method === "DELETE") {
      const id = url.split("/")[3];
      try {
        const success = groupService.deleteGroup(id);
        if (success) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Group deleted successfully" }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Group not found" }));
        }
      } catch (error) {
        console.error("Group deletion error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to delete group" }));
      }
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  } else {
    // ✅ IMPROVED: Static file serving with better error handling
    let filePath = path.join(__dirname, url);
    if (url === "/") {
      filePath = path.join(__dirname, "client/build", "index.html");
    } else if (url.startsWith("/uploads/")) {
      filePath = path.join(__dirname, url);
    } else {
      filePath = path.join(__dirname, "client/build", url);
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".wav": "audio/wav",
      ".mp4": "video/mp4",
      ".woff": "application/font-woff",
      ".eot": "application/vnd.ms-fontobject",
      ".ttf": "font/ttf",
      ".otf": "font/otf",
      ".wasm": "application/wasm",
    };

    const contentType = mimeTypes[extname] || "application/octet-stream";

    // ✅ IMPROVED: Better file serving with proper headers
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code == "ENOENT") {
          // If file not found, serve index.html for client-side routing
          fs.readFile(
            path.join(__dirname, "client/build", "index.html"),
            (err, cont) => {
              if (err) {
                console.error("Error serving fallback:", err);
                res.writeHead(500);
                res.end(
                  "Sorry, check with the site admin for error: " +
                    err.code +
                    " ..\n"
                );
              } else {
                res.writeHead(200, { 
                  "Content-Type": "text/html",
                  "Cache-Control": "no-cache"
                });
                res.end(cont, "utf-8");
              }
            }
          );
        } else {
          console.error("File serving error:", error);
          res.writeHead(500);
          res.end(
            "Sorry, check with the site admin for error: " +
              error.code +
              " ..\n"
          );
        }
      } else {
        // ✅ ADDED: Better caching headers for static assets
        const headers = { "Content-Type": contentType };
        
        if (url.startsWith("/uploads/")) {
          // Font files should be cached
          headers["Cache-Control"] = "public, max-age=31536000"; // 1 year
          headers["Access-Control-Allow-Origin"] = "*";
        } else if (extname === ".js" || extname === ".css") {
          // JS/CSS can be cached but check for updates
          headers["Cache-Control"] = "public, max-age=3600"; // 1 hour
        } else {
          // Other files - minimal caching
          headers["Cache-Control"] = "no-cache";
        }
        
        res.writeHead(200, headers);
        res.end(content, "utf-8");
      }
    });
  }
});

// ✅ ADDED: Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Font Group System Server running on port ${PORT}`);
  console.log(`📁 Fonts directory: ${path.join(__dirname, "uploads", "fonts")}`);
  console.log(`📊 Groups data: ${path.join(__dirname, "data", "groups.json")}`);
});