import React, { useState, useEffect, useRef } from 'react';

const FontList = ({ fonts, onDeleteFont, loadedFonts, fontMetadata }) => {
  const [deletingFont, setDeletingFont] = useState(null);

  const handleDelete = async (font) => {
    try {
      setDeletingFont(font.filename);
      await onDeleteFont(font.filename);
    } catch (error) {
      console.error('Error deleting font:', error);
    } finally {
      setDeletingFont(null);
    }
  };

  // ✅ FIXED: Package-based font preview component with proper loading management
  const PackageBasedPreview = ({ font }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [renderKey, setRenderKey] = useState(0);
    const [isLoadingFont, setIsLoadingFont] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const previewRef = useRef(null);
    const loadingAttemptRef = useRef(null);
    const isMountedRef = useRef(true);
    
    // ✅ FIXED: Cleanup on unmount
    useEffect(() => {
      return () => {
        isMountedRef.current = false;
        if (loadingAttemptRef.current) {
          loadingAttemptRef.current = null;
        }
      };
    }, []);
    
    // ✅ SIMPLE: Find font data using package results
    const findFontData = () => {
      const metadataKeys = Object.keys(fontMetadata);
      
      console.log(`🔍 Looking for font data for "${font.name}"`);
      console.log(`Available metadata keys:`, metadataKeys);
      
      // Strategy 1: Direct family name match
      let matchingKey = metadataKeys.find(key => {
        const keyFamily = key.split('-')[0].toLowerCase();
        const fontNameClean = font.name.toLowerCase().replace(/[^a-z]/g, '');
        return keyFamily.replace(/[^a-z]/g, '') === fontNameClean ||
               keyFamily.includes(fontNameClean.substring(0, 8)) ||
               fontNameClean.includes(keyFamily.substring(0, 8));
      });
      
      // Strategy 2: Filename match
      if (!matchingKey) {
        const filenameClean = font.filename.toLowerCase().replace(/[^a-z]/g, '');
        matchingKey = metadataKeys.find(key => {
          const keyFamily = key.split('-')[0].toLowerCase().replace(/[^a-z]/g, '');
          return keyFamily.includes(filenameClean.substring(0, 8)) ||
                 filenameClean.includes(keyFamily.substring(0, 8));
        });
      }
      
      console.log(`Found matching key: ${matchingKey || 'NONE - using fallback'}`);
      
      if (matchingKey && fontMetadata[matchingKey]) {
        const data = fontMetadata[matchingKey];
        console.log(`Font data found:`, data);
        return data;
      }
      
      // Enhanced fallback
      const name = font.name.toLowerCase();
      const filename = font.filename.toLowerCase();
      const combined = `${name} ${filename}`;
      
      const fallbackData = {
        familyName: font.name
          .replace(/[-_](regular|normal|book)/gi, '')
          .replace(/[-_](thin|light|medium|semibold|bold|extrabold|black)/gi, '')
          .replace(/[-_](italic|oblique)/gi, '')
          .replace(/\.(ttf|otf)$/gi, '')
          .replace(/[-_]/g, ' ')
          .trim(),
        weight: combined.includes('bold') ? 700 : 
                combined.includes('light') ? 300 : 400,
        style: combined.includes('italic') ? 'italic' : 'normal',
        isMonospace: /mono|code|courier|console|terminal|source.?code|fira.?code/.test(combined),
        isSerif: /serif|times|georgia|garamond|baskerville|playfair|crimson|merriweather/.test(combined)
      };
      
      console.log(`Using fallback data:`, fallbackData);
      return fallbackData;
    };

    const fontData = findFontData();
    const fontFamily = fontData.familyName;
    const fontId = `${fontFamily}-${fontData.weight}-${fontData.style}`;
    
    // ✅ FIXED: Check if font is loaded (prevent duplicate loading)
    const isLoaded = loadedFonts.includes(fontId) || 
                     loadedFonts.some(loadedId => {
                       const loadedFamily = loadedId.split('-')[0];
                       return loadedFamily.toLowerCase() === fontFamily.toLowerCase();
                     });
                     
    console.log(`Font loading check for "${font.name}":`);                
    console.log(`  Expected fontId: "${fontId}"`);
    console.log(`  Loaded fonts: [${loadedFonts.join(', ')}]`);
    console.log(`  Is loaded: ${isLoaded}`);

    // ✅ FIXED: Auto-load font with proper error handling and duplicate prevention
    useEffect(() => {
      if (!isLoaded && font && font.path && fontFamily && !isLoadingFont && !loadingAttemptRef.current) {
        const loadFont = async () => {
          if (!isMountedRef.current) return;
          
          setIsLoadingFont(true);
          setLoadError(null);
          loadingAttemptRef.current = font.path;
          
          try {
            // ✅ FIXED: Check if font is already in document.fonts before creating new FontFace
            const existingFont = Array.from(document.fonts).find(fontFace => 
              fontFace.family === fontFamily && 
              fontFace.weight === fontData.weight.toString() && 
              fontFace.style === fontData.style
            );
            
            if (existingFont) {
              console.log(`✅ Font already exists in document.fonts: ${fontFamily}`);
              if (isMountedRef.current) {
                setIsLoadingFont(false);
                setRenderKey(prev => prev + 1);
              }
              return;
            }

            const fontUrl = font.path.startsWith('http')
              ? font.path
              : `${window.location.origin}${font.path.startsWith('/') ? '' : '/'}${font.path}`;
            
            console.log(`🚀 Loading font via FontFace: ${fontFamily} from ${fontUrl}`);
            
            const fontFace = new window.FontFace(
              fontFamily,
              `url("${fontUrl}")`,
              {
                weight: fontData.weight ? fontData.weight.toString() : '400',
                style: fontData.style || 'normal',
                display: 'swap'
              }
            );
            
            // ✅ FIXED: Add timeout to prevent hanging network requests
            const loadPromise = fontFace.load();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Font load timeout')), 5000)
            );
            
            const loadedFace = await Promise.race([loadPromise, timeoutPromise]);
            
            if (isMountedRef.current && loadingAttemptRef.current === font.path) {
              document.fonts.add(loadedFace);
              console.log(`✅ Font loaded successfully: ${fontFamily}`);
              setRenderKey(prev => prev + 1);
            }
            
          } catch (error) {
            console.warn(`⚠️ Font loading failed for ${fontFamily}:`, error.message);
            if (isMountedRef.current && loadingAttemptRef.current === font.path) {
              setLoadError(error.message);
            }
          } finally {
            if (isMountedRef.current && loadingAttemptRef.current === font.path) {
              setIsLoadingFont(false);
              loadingAttemptRef.current = null;
            }
          }
        };

        loadFont();
      }
      // eslint-disable-next-line
    }, [isLoaded, font?.path, fontFamily, fontData.weight, fontData.style, isLoadingFont]);

    // ✅ FIXED: Update visibility when font loads with debouncing
    useEffect(() => {
      if (isLoaded && !isLoadingFont) {
        const timer = setTimeout(() => {
          if (isMountedRef.current) {
            setIsVisible(true);
            setRenderKey(prev => prev + 1);
          }
        }, 200);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
      }
    }, [isLoaded, isLoadingFont]);

    // ✅ CLEAN: Dynamic styling using package data
    const getPackageBasedStyle = () => {
      if (!isLoaded || !isVisible || isLoadingFont) {
        return {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: '#9ca3af',
          lineHeight: '1.3'
        };
      }

      // Use package-detected characteristics
      return {
        fontFamily: `"${fontFamily}", ${getFallbackStack(fontData)}`,
        fontSize: getFontSize(fontData),
        fontWeight: fontData.weight || 400,
        fontStyle: fontData.style || 'normal',
        color: '#111827',
        lineHeight: '1.3',
        letterSpacing: fontData.isMonospace ? '0.05em' : '0.01em',
        fontFeatureSettings: fontData.isMonospace ? '"liga" 0' : 'normal'
      };
    };

    // ✅ SIMPLE: Fallback font stacks
    const getFallbackStack = (fontData) => {
      if (fontData.isMonospace) return 'Consolas, "Courier New", monospace';
      if (fontData.isSerif) return 'Times, serif';
      return 'Arial, sans-serif';
    };

    // ✅ SIMPLE: Font size based on type
    const getFontSize = (fontData) => {
      if (fontData.weight >= 700) return '24px';
      if (fontData.isMonospace) return '20px';
      return '22px';
    };

    // ✅ CLEAN: Smart preview text using package data
    const getPreviewText = () => {
      if (isLoadingFont) return 'Loading font...';
      if (loadError) return 'Loading failed';
      if (!isLoaded || !isVisible) return 'Preparing...';
      
      if (fontData.isMonospace) return 'console.log("Code");';
      if (fontData.isSerif) return 'Elegant Typography';
      if (fontData.weight >= 700) return 'Bold Example Style';
      if (fontData.style === 'italic') return 'Italic Example Style';
      return 'Example Style';
    };

    // ✅ FIXED: Loading indicator with better states
    const LoadingIndicator = () => {
      if (isLoaded && isVisible && !isLoadingFont) return null;
      
      let message = 'Loading...';
      let showSpinner = true;
      
      if (loadError) {
        message = 'Load failed';
        showSpinner = false;
      } else if (isLoadingFont) {
        message = 'Loading font...';
      } else if (isLoaded) {
        message = 'Rendering...';
      }
      
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
          {showSpinner && (
            <div className="animate-spin rounded-full h-3 w-3 border border-gray-300 border-t-blue-500"></div>
          )}
          <span className={loadError ? 'text-red-500' : ''}>{message}</span>
        </div>
      );
    };

    // ✅ CLEAN: Font info using package data
    const FontInfo = () => {
      if (!isVisible || isLoadingFont) return null;
      
      const getTypeInfo = () => {
        const types = [];
        if (fontData.isSerif) types.push('Serif');
        if (fontData.isMonospace) types.push('Monospace');
        if (types.length === 0) types.push('Sans-serif');
        return types.join(' + ');
      };
      
      return (
        <div className="mt-1 text-xs text-gray-500">
          <div className="font-medium">{fontFamily}</div>
          <div>{getTypeInfo()} • Weight: {fontData.weight} • Style: {fontData.style}</div>
        </div>
      );
    };

    return (
      <div className="package-based-preview-container">
        <div 
          ref={previewRef}
          key={renderKey}
          style={getPackageBasedStyle()}
          className="package-based-preview-text"
        >
          {getPreviewText()}
        </div>
        
        <LoadingIndicator />
        <FontInfo />
      </div>
    );
  };

  if (fonts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Package-Based Font Library</h2>
        <p className="text-gray-600 mb-6">Upload fonts - packages automatically detect and apply styling</p>
        
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500">No fonts uploaded yet. Upload any TTF font!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Package-Based Font Library</h2>
      <p className="text-gray-600 mb-6">Clean, package-driven font detection and preview</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Font Name
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Auto Preview
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fonts.map((font) => (
              <tr key={font.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <span className="text-gray-800 font-medium block">{font.name}</span>
                    <span className="text-gray-500 text-sm">{font.filename}</span>
                  </div>
                </td>
                <td className="py-4 px-4 min-w-[350px]">
                  <PackageBasedPreview font={font} />
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => handleDelete(font)}
                    disabled={deletingFont === font.filename}
                    className={`
                      text-red-600 hover:text-red-800 font-medium transition-colors duration-150
                      ${deletingFont === font.filename ? 'opacity-50 cursor-not-allowed' : 'hover:underline'}
                    `}
                  >
                    {deletingFont === font.filename ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        <span>Deleting...</span>
                      </div>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FontList;