import React, { useState, useEffect, useCallback } from 'react';
import FontUploader from './components/FontUploader.jsx';
import FontList from './components/FontList.jsx';
import FontGroupCreator from './components/FontGroupCreator.jsx';
import FontGroupsList from './components/FontGroupsList.jsx';
import { fontService, groupService } from './services/api';

function App() {
  const [fonts, setFonts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadedFonts, setLoadedFonts] = useState([]);
  const [fontMetadata, setFontMetadata] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [fontsData, groupsData] = await Promise.all([
        fontService.getAllFonts(),
        groupService.getAllGroups()
      ]);
      
      setFonts(fontsData);
      setGroups(groupsData);
    } catch (error) {
      showError('Failed to load initial data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // ✅ CLEAN: Use opentype.js package to parse font data
  const parseFontWithPackage = useCallback(async (fontUrl, font) => {
    try {
      console.log(`🔍 Parsing font with opentype.js: ${font.name}`);
      
      // Import opentype.js package
      const opentype = (await import('opentype.js')).default;
      
      // Fetch and parse font file
      const response = await fetch(fontUrl);
      const arrayBuffer = await response.arrayBuffer();
      const parsedFont = opentype.parse(arrayBuffer);
      
      // ✅ CLEAN: Extract data using package APIs
      const fontData = {
        familyName: parsedFont.names.fontFamily?.en || 
                   parsedFont.names.fullName?.en || 
                   font.name,
        
        weight: parsedFont.tables.os2?.usWeightClass || 400,
        
        style: parsedFont.names.fontSubfamily?.en?.toLowerCase().includes('italic') ? 
               'italic' : 'normal',
        
        // Use package to detect font characteristics
        isMonospace: await detectMonospace(parsedFont),
        isSerif: await detectSerif(parsedFont),
        
        // Typography metrics from package
        metrics: {
          unitsPerEm: parsedFont.unitsPerEm,
          ascender: parsedFont.tables.hhea?.ascender,
          descender: parsedFont.tables.hhea?.descender,
          lineGap: parsedFont.tables.hhea?.lineGap
        }
      };
      
      console.log(`✅ Font parsed by package:`, fontData);
      return fontData;
      
    } catch (error) {
      console.warn(`⚠️ Package parsing failed, using filename fallback:`, error);
      return createMinimalFallback(font);
    }
  }, []);

  // ✅ CLEAN: Use package to detect monospace fonts
  const detectMonospace = async (parsedFont) => {
    const familyName = (parsedFont.names.fontFamily?.en || '').toLowerCase();
    const fullName = (parsedFont.names.fullName?.en || '').toLowerCase();
    
    // Check names first
    const allNames = `${familyName} ${fullName}`;
    if (/mono|code|courier|console|terminal|source.?code|fira.?code|jetbrains/.test(allNames)) {
      return true;
    }
    
    try {
      // Test character width consistency
      const testChars = ['i', 'm', 'W', '1'];
      const widths = testChars.map(char => {
        const glyph = parsedFont.charToGlyph(char);
        return glyph ? glyph.advanceWidth : 0;
      }).filter(w => w > 0);
      
      if (widths.length >= 3) {
        const firstWidth = widths[0];
        const isMonospace = widths.every(w => Math.abs(w - firstWidth) < 10);
        return isMonospace;
      }
    } catch (e) {
      // Ignore glyph errors
    }
    
    return false;
  };

  // ✅ CLEAN: Use package to detect serif fonts
  const detectSerif = async (parsedFont) => {
    const familyName = (parsedFont.names.fontFamily?.en || '').toLowerCase();
    const fullName = (parsedFont.names.fullName?.en || '').toLowerCase();
    const postScript = (parsedFont.names.postScriptName?.en || '').toLowerCase();
    
    // Check all font name fields for serif indicators
    const allNames = `${familyName} ${fullName} ${postScript}`;
    
    return /serif|times|georgia|garamond|baskerville|playfair|crimson|merriweather|caslon|minion/.test(allNames);
  };

  // ✅ MINIMAL: Simple fallback without hardcoded logic
  const createMinimalFallback = (font) => {
    const name = font.name.toLowerCase();
    const filename = font.filename.toLowerCase();
    const combined = `${name} ${filename}`;
    
    // Clean family name
    const familyName = font.name
      .replace(/[-_](regular|normal|book)/gi, '')
      .replace(/[-_](thin|light|medium|semibold|bold|extrabold|black)/gi, '')
      .replace(/[-_](italic|oblique)/gi, '')
      .replace(/\.(ttf|otf)$/gi, '')
      .replace(/[-_]/g, ' ')
      .trim();
    
    return {
      familyName,
      weight: combined.includes('bold') ? 700 : 
              combined.includes('light') ? 300 : 400,
      style: combined.includes('italic') ? 'italic' : 'normal',
      isMonospace: /mono|code|courier|console|terminal|source.?code|fira.?code/.test(combined),
      isSerif: /serif|times|georgia|garamond|baskerville|playfair|crimson|merriweather/.test(combined),
      metrics: {}
    };
  };

  // ✅ CLEAN: Load font using packages
  const loadFontWithPackages = useCallback(async (font) => {
    try {
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:5000' 
        : window.location.origin;
      const fontUrl = `${baseUrl}${font.path}`;
      
      console.log(`🚀 Loading font: ${font.name}`);
      
      // 1. Parse font data with package
      const fontData = await parseFontWithPackage(fontUrl, font);
      const fontFamily = fontData.familyName;
      const fontId = `${fontFamily}-${fontData.weight}-${fontData.style}`;
      
      // Store font data
      setFontMetadata(prev => ({
        ...prev,
        [fontId]: fontData
      }));
      
      // 2. Check if already loaded
      if (document.fonts.check(`${fontData.weight} ${fontData.style} 16px "${fontFamily}"`)) {
        console.log(`✅ Font already loaded: ${fontFamily}`);
        return fontId;
      }
      
      // 3. Create and load FontFace
      const fontFace = new FontFace(fontFamily, `url("${fontUrl}")`, {
        weight: fontData.weight.toString(),
        style: fontData.style,
        display: 'swap'
      });
      
      await fontFace.load();
      document.fonts.add(fontFace);
      
      // 4. Verify with FontFaceObserver package
      try {
        const FontFaceObserver = (await import('fontfaceobserver')).default;
        const observer = new FontFaceObserver(fontFamily, {
          weight: fontData.weight,
          style: fontData.style
        });
        await observer.load(null, 3000);
      } catch (observerError) {
        // Fallback verification
        await document.fonts.ready;
      }
      
      console.log(`✅ Font loaded successfully: ${fontFamily}`);
      return fontId;
      
    } catch (error) {
      console.error(`❌ Font loading failed: ${error.message}`);
      return null;
    }
  }, [parseFontWithPackage]);

  // Load all fonts
  useEffect(() => {
    const loadAllFonts = async () => {
      if (fonts.length === 0) {
        setLoadedFonts([]);
        setFontMetadata({});
        return;
      }

      console.log(`📦 Loading ${fonts.length} fonts with packages...`);

      const loadPromises = fonts.map(font => loadFontWithPackages(font));
      const results = await Promise.allSettled(loadPromises);
      
      const successfullyLoaded = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
      
      setLoadedFonts(successfullyLoaded);
      console.log(`✅ Loaded ${successfullyLoaded.length}/${fonts.length} fonts`);
    };

    loadAllFonts();
  }, [fonts, loadFontWithPackages]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Font handlers
  const handleFontUpload = async (file) => {
    try {
      console.log(`📤 Uploading: ${file.name}`);
      const uploadedFont = await fontService.uploadFont(file);
      setFonts(prev => [...prev, uploadedFont]);
      
      const fontId = await loadFontWithPackages(uploadedFont);
      if (fontId) {
        setLoadedFonts(prev => [...prev, fontId]);
      }
      
      return uploadedFont;
    } catch (error) {
      throw new Error('Failed to upload font: ' + error.message);
    }
  };

  const handleFontDelete = async (filename) => {
    try {
      await fontService.deleteFont(filename);
      
      const fontToRemove = fonts.find(font => font.filename === filename);
      setFonts(prev => prev.filter(font => font.filename !== filename));
      
      if (fontToRemove) {
        // Clean up font data
        setLoadedFonts(prev => prev.filter(fontId => !fontId.includes(fontToRemove.name)));
        setFontMetadata(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (key.includes(fontToRemove.name)) delete updated[key];
          });
          return updated;
        });
      }
    } catch (error) {
      throw new Error('Failed to delete font: ' + error.message);
    }
  };

  // Group handlers
  const handleGroupCreate = async (groupData) => {
    try {
      const createdGroup = await groupService.createGroup(groupData);
      setGroups(prev => [...prev, createdGroup]);
      return createdGroup;
    } catch (error) {
      throw new Error('Failed to create group: ' + error.message);
    }
  };

  const handleGroupEdit = async (groupId, groupData) => {
    try {
      const updatedGroup = await groupService.updateGroup(groupId, groupData);
      setGroups(prev => prev.map(group => 
        group.id === groupId ? updatedGroup : group
      ));
      return updatedGroup;
    } catch (error) {
      throw new Error('Failed to update group: ' + error.message);
    }
  };

  const handleGroupDelete = async (groupId) => {
    try {
      await groupService.deleteGroup(groupId);
      setGroups(prev => prev.filter(group => group.id !== groupId));
    } catch (error) {
      throw new Error('Failed to delete group: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Package-Based Font System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Package-Based Font System</h1>
          <p className="mt-2 text-gray-600">Clean, package-driven font detection and styling</p>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <FontUploader onFontUploaded={handleFontUpload} onError={showError} />
        
        <FontList
          fonts={fonts}
          loadedFonts={loadedFonts}
          fontMetadata={fontMetadata}
          onDeleteFont={handleFontDelete}
        />
        
        <FontGroupCreator fonts={fonts} onCreateGroup={handleGroupCreate} onError={showError} />
        
        <FontGroupsList
          groups={groups}
          fonts={fonts}
          onEditGroup={handleGroupEdit}
          onDeleteGroup={handleGroupDelete}
          onError={showError}
        />
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Package-Based Font System - Clean & Efficient
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;