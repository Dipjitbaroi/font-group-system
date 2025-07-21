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
  const [fontCharacteristics, setFontCharacteristics] = useState({}); // Store font characteristics
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

  // ✅ NEW: Parse actual font file to get real characteristics
  const parseFontFile = useCallback(async (fontUrl, font) => {
    try {
      console.log(`🔍 Parsing font file: ${font.name}`);
      
      // Dynamic import for opentype.js (since it might not be installed yet)
      let opentype;
      try {
        opentype = await import('opentype.js');
        opentype = opentype.default || opentype;
      } catch (importError) {
        console.warn('opentype.js not available, using fallback parsing');
        return getFallbackCharacteristics(font);
      }
      
      // Load font file as ArrayBuffer
      const response = await fetch(fontUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Parse with opentype.js
      const parsedFont = opentype.parse(arrayBuffer);
      
      // Extract real font information
      const characteristics = {
        familyName: parsedFont.names.fontFamily?.en || parsedFont.names.fullName?.en || font.name,
        fullName: parsedFont.names.fullName?.en,
        postScriptName: parsedFont.names.postScriptName?.en,
        weight: parsedFont.tables.os2?.usWeightClass || 400,
        style: parsedFont.names.fontSubfamily?.en?.toLowerCase().includes('italic') ? 'italic' : 'normal',
        isSerif: detectSerif(parsedFont),
        isMonospace: detectMonospace(parsedFont),
        characteristics: {
          ascender: parsedFont.tables.os2?.sTypoAscender,
          descender: parsedFont.tables.os2?.sTypoDescender,
          lineGap: parsedFont.tables.os2?.sTypoLineGap,
          xHeight: parsedFont.tables.os2?.sxHeight,
          capHeight: parsedFont.tables.os2?.sCapHeight
        }
      };
      
      console.log(`✅ Font parsed:`, characteristics);
      return characteristics;
      
    } catch (error) {
      console.error(`❌ Font parsing failed for ${font.name}:`, error);
      return getFallbackCharacteristics(font);
    }
  }, []);

  // Fallback characteristics when opentype.js is not available
  const getFallbackCharacteristics = useCallback((font) => {
    const name = font.name.toLowerCase();
    const filename = font.filename.toLowerCase();
    
    // Google Fonts mapping
    const googleFontsMap = {
      'oswald': { family: 'Oswald', isSerif: false, isMonospace: false },
      'playfairdisplay': { family: 'Playfair Display', isSerif: true, isMonospace: false },
      'roboto': { family: 'Roboto', isSerif: false, isMonospace: false },
      'opensans': { family: 'Open Sans', isSerif: false, isMonospace: false },
      'lato': { family: 'Lato', isSerif: false, isMonospace: false },
      'montserrat': { family: 'Montserrat', isSerif: false, isMonospace: false },
      'poppins': { family: 'Poppins', isSerif: false, isMonospace: false },
      'sourcecodepro': { family: 'Source Code Pro', isSerif: false, isMonospace: true },
      'firacode': { family: 'Fira Code', isSerif: false, isMonospace: true },
      'bitcountgridsingle': { family: 'Bitcount Grid Single', isSerif: false, isMonospace: false },
    };

    // ✅ FIXED: Clean name for lookup (remove weight/style indicators)
    const cleanName = name
      .replace(/-(regular|bold|light|medium|semibold|extrabold|black|thin|extralight)/gi, '')
      .replace(/-(italic|oblique)/gi, '')
      .replace(/variablefont.*$/gi, '')
      .replace(/[^a-z]/g, '');
      
    const mapped = googleFontsMap[cleanName];
    
    if (mapped) {
      return {
        familyName: mapped.family,
        weight: (name + filename).includes('bold') ? 700 : (name + filename).includes('light') ? 300 : 400,
        style: (name + filename).includes('italic') ? 'italic' : 'normal',
        isSerif: mapped.isSerif,
        isMonospace: mapped.isMonospace
      };
    }

    // ✅ FIXED: Better fallback family name generation
    const fallbackFamily = font.name
      .replace(/-(regular|bold|light|medium|semibold|extrabold|black|thin|extralight)/gi, '')
      .replace(/-(italic|oblique)/gi, '')
      .replace(/VariableFont.*$/gi, '')
      .replace(/[_-]/g, ' ')
      .replace(/\.(ttf|otf)$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();

    return {
      familyName: fallbackFamily,
      weight: (name + filename).includes('bold') ? 700 : (name + filename).includes('light') ? 300 : 400,
      style: (name + filename).includes('italic') ? 'italic' : 'normal',
      isSerif: (name + filename).includes('serif'),
      isMonospace: (name + filename).includes('mono') || (name + filename).includes('code')
    };
  }, []);

  // Helper functions for font detection
  const detectSerif = (parsedFont) => {
    const familyName = (parsedFont.names.fontFamily?.en || '').toLowerCase();
    const serifKeywords = ['serif', 'times', 'georgia', 'garamond', 'crimson', 'playfair'];
    return serifKeywords.some(keyword => familyName.includes(keyword));
  };

  const detectMonospace = (parsedFont) => {
    const familyName = (parsedFont.names.fontFamily?.en || '').toLowerCase();
    const monoKeywords = ['mono', 'code', 'courier', 'console', 'terminal', 'source code'];
    return monoKeywords.some(keyword => familyName.includes(keyword));
  };

  // ✅ IMPROVED: Load font with real characteristics
  const loadSingleFont = useCallback(async (font) => {
    try {
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:5000' 
        : window.location.origin;
      const fontUrl = `${baseUrl}${font.path}`;
      
      // 1. Parse font file to get real characteristics
      const characteristics = await parseFontFile(fontUrl, font);
      const fontFamily = characteristics.familyName;
      const fontId = `${fontFamily}-${characteristics.weight}-${characteristics.style}`;
      
      console.log(`🚀 Creating fontId for ${font.name}:`);
      console.log(`   Family: "${fontFamily}"`);
      console.log(`   Weight: ${characteristics.weight}`);
      console.log(`   Style: ${characteristics.style}`);
      console.log(`   Final fontId: "${fontId}"`);
      
      // Store characteristics
      setFontCharacteristics(prev => ({
        ...prev,
        [fontId]: characteristics
      }));
      
      // 2. Check if already loaded
      if (document.fonts.check(`${characteristics.weight} ${characteristics.style} 16px "${fontFamily}"`)) {
        console.log(`✅ Font already loaded: ${fontFamily}`);
        return fontId;
      }
      
      console.log(`🔄 Loading font: ${fontFamily}`, characteristics);
      
      // 3. Create FontFace with parsed characteristics
      const fontFace = new FontFace(fontFamily, `url("${fontUrl}")`, {
        weight: characteristics.weight.toString(),
        style: characteristics.style,
        display: 'swap'
      });
      
      // 4. Load font
      await fontFace.load();
      document.fonts.add(fontFace);
      
      // 5. Enhanced verification (with shorter timeout)
      let FontFaceObserver;
      try {
        FontFaceObserver = (await import('fontfaceobserver')).default;
        const fontObserver = new FontFaceObserver(fontFamily, {
          weight: characteristics.weight,
          style: characteristics.style
        });
        await fontObserver.load(null, 2000); // ✅ REDUCED: 2s timeout (was 5s)
      } catch (observerError) {
        // Fallback to basic check if FontFaceObserver not available
        await document.fonts.ready;
        if (!document.fonts.check(`${characteristics.weight} ${characteristics.style} 16px "${fontFamily}"`)) {
          throw new Error('Font verification failed');
        }
      }
      
      console.log(`✅ Font loaded and verified: ${fontFamily}`);
      
      // Store metadata
      setFontMetadata(prev => ({
        ...prev,
        [fontId]: {
          family: fontFamily,
          weight: characteristics.weight,
          style: characteristics.style,
          fullName: characteristics.fullName
        }
      }));
      
      return fontId;
      
    } catch (error) {
      console.error(`❌ Failed to load font ${font.name}:`, error.message);
      return null;
    }
  }, [parseFontFile]);

  // Font loading effect
  useEffect(() => {
    const loadAllFonts = async () => {
      if (fonts.length === 0) {
        setLoadedFonts([]);
        setFontMetadata({});
        setFontCharacteristics({});
        return;
      }

      console.log(`🔄 Loading ${fonts.length} fonts with enhanced parsing...`);

      const loadPromises = fonts.map(async (font) => {
        return await loadSingleFont(font);
      });

      try {
        const results = await Promise.allSettled(loadPromises);
        const successfullyLoaded = results
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value);
        
        setLoadedFonts(successfullyLoaded);
        console.log(`✅ Successfully loaded ${successfullyLoaded.length} fonts`);

      } catch (error) {
        console.error('❌ Error in font loading process:', error);
      }
    };

    loadAllFonts();
  }, [fonts, loadSingleFont]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Font handlers
  const handleFontUpload = async (file) => {
    try {
      console.log(`🔄 Uploading font: ${file.name}`);
      const uploadedFont = await fontService.uploadFont(file);
      setFonts(prev => [...prev, uploadedFont]);
      
      const fontId = await loadSingleFont(uploadedFont);
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
        // Remove all related data
        setLoadedFonts(prev => prev.filter(fontId => !fontId.includes(fontToRemove.name)));
        setFontMetadata(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(key => {
            if (key.includes(fontToRemove.name)) delete updated[key];
          });
          return updated;
        });
        setFontCharacteristics(prev => {
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
          <p className="text-gray-600">Loading Font Group System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Font Group System</h1>
          <p className="mt-2 text-gray-600">Upload fonts and create organized font groups</p>
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
          fontCharacteristics={fontCharacteristics}
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
            Font Group System - Built with React.js and Node.js
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;