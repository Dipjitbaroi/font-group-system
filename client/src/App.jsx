import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // ✅ FIXED: Track loading states to prevent duplicates
  const [loadingFonts, setLoadingFonts] = useState(new Set());
  const loadingRef = useRef(new Set());
  const isMountedRef = useRef(true);

  // ✅ FIXED: Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      
      if (isMountedRef.current) {
        setFonts(fontsData);
        setGroups(groupsData);
      }
    } catch (error) {
      if (isMountedRef.current) {
        showError('Failed to load initial data: ' + error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [showError]);

  // ✅ FIXED: Font validation before parsing
  const isValidFontBuffer = (arrayBuffer) => {
    if (!arrayBuffer || arrayBuffer.byteLength < 100) return false;
    
    const view = new DataView(arrayBuffer);
    // Check for common font signatures
    const signature = view.getUint32(0, false);
    const validSignatures = [
      0x00010000, // TrueType
      0x74727565, // 'true' (TrueType)
      0x4F54544F, // 'OTTO' (OpenType with CFF)
      0x74746366, // 'ttcf' (TrueType Collection)
    ];
    
    return validSignatures.includes(signature);
  };

  // ✅ FIXED: Use opentype.js package to parse font data with better error handling
  const parseFontWithPackage = useCallback(async (fontUrl, font) => {
    try {
      console.log(`🔍 Parsing font with opentype.js: ${font.name}`);
      
      // ✅ FIXED: Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(fontUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // ✅ FIXED: Validate font buffer before parsing
      if (!isValidFontBuffer(arrayBuffer)) {
        throw new Error('Invalid font file format');
      }
      
      // Import opentype.js package
      const opentype = (await import('opentype.js')).default;
      
      // ✅ FIXED: Add try-catch around opentype parsing
      let parsedFont;
      try {
        parsedFont = opentype.parse(arrayBuffer);
      } catch (parseError) {
        throw new Error(`OpenType parsing failed: ${parseError.message}`);
      }
      
      // ✅ FIXED: Validate parsed font object
      if (!parsedFont || !parsedFont.names) {
        throw new Error('Parsed font is invalid or corrupted');
      }
      
      // ✅ CLEAN: Extract data using package APIs with fallbacks
      const fontData = {
        familyName: parsedFont.names.fontFamily?.en || 
                   parsedFont.names.fullName?.en || 
                   parsedFont.names.preferredFamily?.en ||
                   font.name,
        
        weight: parsedFont.tables?.os2?.usWeightClass || 400,
        
        style: (parsedFont.names.fontSubfamily?.en || '').toLowerCase().includes('italic') ? 
               'italic' : 'normal',
        
        // Use package to detect font characteristics
        isMonospace: await detectMonospace(parsedFont),
        isSerif: await detectSerif(parsedFont),
        
        // Typography metrics from package (with safety checks)
        metrics: {
          unitsPerEm: parsedFont.unitsPerEm || 1000,
          ascender: parsedFont.tables?.hhea?.ascender || 0,
          descender: parsedFont.tables?.hhea?.descender || 0,
          lineGap: parsedFont.tables?.hhea?.lineGap || 0
        }
      };
      
      console.log(`✅ Font parsed by package:`, fontData);
      return fontData;
      
    } catch (error) {
      console.warn(`⚠️ Package parsing failed for ${font.name}:`, error.message);
      return createMinimalFallback(font);
    }
  }, []);

  // ✅ FIXED: Use package to detect monospace fonts with better error handling
  const detectMonospace = async (parsedFont) => {
    try {
      const familyName = (parsedFont.names?.fontFamily?.en || '').toLowerCase();
      const fullName = (parsedFont.names?.fullName?.en || '').toLowerCase();
      
      // Check names first
      const allNames = `${familyName} ${fullName}`;
      if (/mono|code|courier|console|terminal|source.?code|fira.?code|jetbrains/.test(allNames)) {
        return true;
      }
      
      // Test character width consistency
      const testChars = ['i', 'm', 'W', '1'];
      const widths = [];
      
      for (const char of testChars) {
        try {
          const glyph = parsedFont.charToGlyph && parsedFont.charToGlyph(char);
          if (glyph && typeof glyph.advanceWidth === 'number' && glyph.advanceWidth > 0) {
            widths.push(glyph.advanceWidth);
          }
        } catch (e) {
          // Skip problematic characters
        }
      }
      
      if (widths.length >= 3) {
        const firstWidth = widths[0];
        const isMonospace = widths.every(w => Math.abs(w - firstWidth) < 10);
        return isMonospace;
      }
    } catch (e) {
      console.warn('Error detecting monospace:', e.message);
    }
    
    return false;
  };

  // ✅ FIXED: Use package to detect serif fonts with safety checks
  const detectSerif = async (parsedFont) => {
    try {
      const familyName = (parsedFont.names?.fontFamily?.en || '').toLowerCase();
      const fullName = (parsedFont.names?.fullName?.en || '').toLowerCase();
      const postScript = (parsedFont.names?.postScriptName?.en || '').toLowerCase();
      
      // Check all font name fields for serif indicators
      const allNames = `${familyName} ${fullName} ${postScript}`;
      
      return /serif|times|georgia|garamond|baskerville|playfair|crimson|merriweather|caslon|minion/.test(allNames);
    } catch (e) {
      console.warn('Error detecting serif:', e.message);
      return false;
    }
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

  // ✅ FIXED: Load font using packages with duplicate prevention
  const loadFontWithPackages = useCallback(async (font) => {
    const fontKey = `${font.name}-${font.filename}`;
    
    // ✅ FIXED: Prevent duplicate loading
    if (loadingRef.current.has(fontKey)) {
      console.log(`⏭️ Font already loading: ${font.name}`);
      return null;
    }
    
    try {
      loadingRef.current.add(fontKey);
      setLoadingFonts(prev => new Set([...prev, fontKey]));
      
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:5000' 
        : window.location.origin;
      const fontUrl = `${baseUrl}${font.path}`;
      
      console.log(`🚀 Loading font: ${font.name}`);
      
      // 1. Parse font data with package
      const fontData = await parseFontWithPackage(fontUrl, font);
      const fontFamily = fontData.familyName;
      const fontId = `${fontFamily}-${fontData.weight}-${fontData.style}`;
      
      if (!isMountedRef.current) return null;
      
      // Store font data
      setFontMetadata(prev => ({
        ...prev,
        [fontId]: fontData
      }));
      
      // 2. Check if already loaded in document.fonts
      const existingFont = Array.from(document.fonts).find(fontFace => 
        fontFace.family === fontFamily && 
        fontFace.weight === fontData.weight.toString() && 
        fontFace.style === fontData.style
      );
      
      if (existingFont && existingFont.status === 'loaded') {
        console.log(`✅ Font already loaded in document: ${fontFamily}`);
        return fontId;
      }
      
      // 3. Create and load FontFace with timeout
      const fontFace = new FontFace(fontFamily, `url("${fontUrl}")`, {
        weight: fontData.weight.toString(),
        style: fontData.style,
        display: 'swap'
      });
      
      // ✅ FIXED: Add timeout to prevent hanging
      const loadPromise = fontFace.load();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Font load timeout after 15 seconds')), 15000)
      );
      
      await Promise.race([loadPromise, timeoutPromise]);
      
      if (!isMountedRef.current) return null;
      
      document.fonts.add(fontFace);
      
      // 4. Verify loading with FontFaceObserver (optional, with timeout)
      try {
        const FontFaceObserver = (await import('fontfaceobserver')).default;
        const observer = new FontFaceObserver(fontFamily, {
          weight: fontData.weight,
          style: fontData.style
        });
        await Promise.race([
          observer.load(null, 5000),
          new Promise(resolve => setTimeout(resolve, 5000)) // Don't fail on observer timeout
        ]);
      } catch (observerError) {
        console.warn('FontFaceObserver failed, but font loaded via FontFace API');
      }
      
      console.log(`✅ Font loaded successfully: ${fontFamily}`);
      return fontId;
      
    } catch (error) {
      console.error(`❌ Font loading failed for ${font.name}:`, error.message);
      return null;
    } finally {
      loadingRef.current.delete(fontKey);
      if (isMountedRef.current) {
        setLoadingFonts(prev => {
          const updated = new Set(prev);
          updated.delete(fontKey);
          return updated;
        });
      }
    }
  }, [parseFontWithPackage]);

  // ✅ FIXED: Load all fonts with better error handling and progress tracking
  useEffect(() => {
    const loadAllFonts = async () => {
      if (fonts.length === 0) {
        setLoadedFonts([]);
        setFontMetadata({});
        return;
      }

      console.log(`📦 Loading ${fonts.length} fonts with packages...`);
      
      // ✅ FIXED: Load fonts sequentially to prevent overwhelming the system
      const results = [];
      
      for (const font of fonts) {
        if (!isMountedRef.current) break;
        
        try {
          const result = await loadFontWithPackages(font);
          results.push({ status: 'fulfilled', value: result });
        } catch (error) {
          results.push({ status: 'rejected', reason: error });
        }
      }
      
      if (isMountedRef.current) {
        const successfullyLoaded = results
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);
        
        setLoadedFonts(successfullyLoaded);
        console.log(`✅ Loaded ${successfullyLoaded.length}/${fonts.length} fonts`);
      }
    };

    loadAllFonts();
  }, [fonts, loadFontWithPackages]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ✅ FIXED: Font handlers with better error handling
  const handleFontUpload = async (file) => {
    try {
      console.log(`📤 Uploading: ${file.name}`);
      const uploadedFont = await fontService.uploadFont(file);
      
      if (isMountedRef.current) {
        setFonts(prev => [...prev, uploadedFont]);
        
        // Load the uploaded font immediately
        const fontId = await loadFontWithPackages(uploadedFont);
        if (fontId && isMountedRef.current) {
          setLoadedFonts(prev => [...prev, fontId]);
        }
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
      
      if (isMountedRef.current) {
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
      }
    } catch (error) {
      throw new Error('Failed to delete font: ' + error.message);
    }
  };

  // Group handlers
  const handleGroupCreate = async (groupData) => {
    try {
      const createdGroup = await groupService.createGroup(groupData);
      if (isMountedRef.current) {
        setGroups(prev => [...prev, createdGroup]);
      }
      return createdGroup;
    } catch (error) {
      throw new Error('Failed to create group: ' + error.message);
    }
  };

  const handleGroupEdit = async (groupId, groupData) => {
    try {
      const updatedGroup = await groupService.updateGroup(groupId, groupData);
      if (isMountedRef.current) {
        setGroups(prev => prev.map(group => 
          group.id === groupId ? updatedGroup : group
        ));
      }
      return updatedGroup;
    } catch (error) {
      throw new Error('Failed to update group: ' + error.message);
    }
  };

  const handleGroupDelete = async (groupId) => {
    try {
      await groupService.deleteGroup(groupId);
      if (isMountedRef.current) {
        setGroups(prev => prev.filter(group => group.id !== groupId));
      }
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
          
          {/* ✅ ADDED: Loading progress indicator */}
          {loadingFonts.size > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 text-sm">
                  Loading {loadingFonts.size} font{loadingFonts.size > 1 ? 's' : ''}...
                </span>
              </div>
            </div>
          )}
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