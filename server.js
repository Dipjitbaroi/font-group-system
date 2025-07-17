const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for font uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fontService.uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (ValidationService.validateTTFFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Only TTF files are allowed!'), false);
    }
  }
});

// SOLID Principle: Single Responsibility - Route handlers
// Font routes
app.get('/api/fonts', (req, res) => {
  try {
    const fonts = fontService.getAllFonts();
    res.json(fonts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fonts' });
  }
});

app.post('/api/fonts/upload', upload.single('font'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const font = {
      id: req.file.filename.replace('.ttf', ''),
      name: req.file.filename.replace('.ttf', ''),
      filename: req.file.filename,
      path: `/uploads/fonts/${req.file.filename}`
    };
    
    res.json(font);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload font' });
  }
});

app.delete('/api/fonts/:filename', (req, res) => {
  try {
    const success = fontService.deleteFont(req.params.filename);
    if (success) {
      res.json({ message: 'Font deleted successfully' });
    } else {
      res.status(404).json({ error: 'Font not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete font' });
  }
});

// Group routes
app.get('/api/groups', (req, res) => {
  try {
    const groups = groupService.getAllGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.post('/api/groups', (req, res) => {
  try {
    if (!ValidationService.validateGroup(req.body)) {
      return res.status(400).json({ error: 'Invalid group data. Must have title and at least 2 fonts.' });
    }
    
    const group = groupService.createGroup(req.body);
    if (group) {
      res.json(group);
    } else {
      res.status(500).json({ error: 'Failed to create group' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.put('/api/groups/:id', (req, res) => {
  try {
    if (!ValidationService.validateGroup(req.body)) {
      return res.status(400).json({ error: 'Invalid group data. Must have title and at least 2 fonts.' });
    }
    
    const group = groupService.updateGroup(req.params.id, req.body);
    if (group) {
      res.json(group);
    } else {
      res.status(404).json({ error: 'Group not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.delete('/api/groups/:id', (req, res) => {
  try {
    const success = groupService.deleteGroup(req.params.id);
    if (success) {
      res.json({ message: 'Group deleted successfully' });
    } else {
      res.status(404).json({ error: 'Group not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
