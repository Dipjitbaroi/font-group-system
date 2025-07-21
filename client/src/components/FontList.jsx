import React, { useState, useEffect, useRef } from 'react';

const FontList = ({ fonts, onDeleteFont, loadedFonts, fontMetadata, fontCharacteristics }) => {
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

  // ✅ FIXED: Dynamic Font Preview with Proper Key Matching
  const DynamicFontPreview = ({ font }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [renderKey, setRenderKey] = useState(0);
    const previewRef = useRef(null);
    
    // ✅ FIXED: Find font characteristics with proper matching
    const findFontCharacteristics = () => {
      // Get the font filename without extension for matching
      const fontFileName = font.filename.replace(/\.(ttf|otf|woff|woff2)$/i, '');
      
      // Look for exact fontId match first
      const fontKeys = Object.keys(fontCharacteristics);
      
      // Try multiple matching strategies
      let matchingKey = null;
      
      // Strategy 1: Direct filename match in key
      matchingKey = fontKeys.find(key => {
        const keyFamily = key.split('-')[0];
        return keyFamily.toLowerCase().replace(/[^a-z]/g, '') === 
               fontFileName.toLowerCase().replace(/[^a-z]/g, '');
      });
      
      // Strategy 2: Font name match
      if (!matchingKey) {
        matchingKey = fontKeys.find(key => {
          const keyFamily = key.split('-')[0];
          return keyFamily.toLowerCase().replace(/[^a-z]/g, '') === 
                 font.name.toLowerCase().replace(/[^a-z]/g, '');
        });
      }
      
      // Strategy 3: Partial match
      if (!matchingKey) {
        const cleanFontName = font.name.toLowerCase().replace(/[^a-z]/g, '');
        matchingKey = fontKeys.find(key => {
          const keyLower = key.toLowerCase().replace(/[^a-z]/g, '');
          return keyLower.includes(cleanFontName.substring(0, 8)) || 
                 cleanFontName.includes(keyLower.substring(0, 8));
        });
      }
      
      console.log(`🔍 Font matching for "${font.name}":`);;
      console.log(`   Available keys: [${fontKeys.join(', ')}]`);
      console.log(`   Found match: ${matchingKey || 'NONE'}`);
      
      if (matchingKey) {
        return fontCharacteristics[matchingKey];
      }
      
      // Fallback characteristics
      console.log(`⚠️  Using fallback for ${font.name}`);
      const name = font.name.toLowerCase();
      return {
        familyName: font.name.replace(/[_-]/g, ' ').replace(/\.(ttf|otf)$/i, ''),
        weight: name.includes('bold') ? 700 : name.includes('light') ? 300 : 400,
        style: name.includes('italic') ? 'italic' : 'normal',
        isSerif: name.includes('serif') || name.includes('playfair') || name.includes('times'),
        isMonospace: name.includes('mono') || name.includes('code') || name.includes('courier')
      };
    };

    const characteristics = findFontCharacteristics();
    const fontFamily = characteristics.familyName;
    const fontId = `${fontFamily}-${characteristics.weight}-${characteristics.style}`;
    
    // ✅ FIXED: Check if font is actually loaded
    const isLoaded = loadedFonts.includes(fontId) || 
                     loadedFonts.some(loadedId => {
                       const loadedFamily = loadedId.split('-')[0];
                       return loadedFamily === fontFamily;
                     });
    
    console.log(`🎯 Font "${font.name}" -> Family: "${fontFamily}" -> Loaded: ${isLoaded}`);
    console.log(`   Looking for fontId: "${fontId}"`);
    console.log(`   Available loadedFonts: [${loadedFonts.join(', ')}]`);

    // Update visibility when font loads
    useEffect(() => {
      if (isLoaded) {
        const timer = setTimeout(() => {
          setIsVisible(true);
          setRenderKey(prev => prev + 1);
        }, 100); // ✅ REDUCED: Faster visibility (was 400ms)
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
      }
    }, [isLoaded]);

    // ✅ ENHANCED: Dynamic styling based on font characteristics
    const getPreviewStyle = () => {
      const baseStyle = {
        fontSize: '22px',
        lineHeight: '1.2',
        minHeight: '32px',
        display: 'block',
        transition: 'all 0.5s ease-in-out',
        letterSpacing: characteristics.isMonospace ? '0.05em' : '0.01em'
      };

      if (!isLoaded || !isVisible) {
        return {
          ...baseStyle,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: '#9ca3af',
          fontSize: '18px'
        };
      }

      // Apply real font characteristics
      return {
        ...baseStyle,
        fontFamily: `"${fontFamily}", ${getFallbackFontStack()}`,
        fontWeight: characteristics.weight || 400,
        fontStyle: characteristics.style || 'normal',
        color: '#111827',
        // Enhanced styling for different font types
        ...(characteristics.isSerif && {
          letterSpacing: '0.02em',
          fontSize: '24px'
        }),
        ...(characteristics.isMonospace && {
          letterSpacing: '0.05em',
          fontSize: '20px',
          fontFeatureSettings: '"liga" 0' // Disable ligatures for code fonts
        })
      };
    };

    // Get appropriate fallback font stack
    const getFallbackFontStack = () => {
      if (characteristics.isMonospace) {
        return '"SF Mono", "Monaco", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace';
      } else if (characteristics.isSerif) {
        return '"Times New Roman", "Georgia", "Garamond", serif';
      } else {
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      }
    };

    // ✅ ENHANCED: Show progressive loading states
    const getLoadingState = () => {
      // Check if font is in any stage of loading
      const fontKeys = Object.keys(fontCharacteristics);
      const hasCharacteristics = fontKeys.some(key => 
        key.includes(font.name.replace(/[^a-zA-Z0-9]/g, '')) ||
        key.toLowerCase().includes(font.name.toLowerCase().replace(/[^a-z]/g, ''))
      );
      
      if (isLoaded && isVisible) return 'loaded';
      if (isLoaded && !isVisible) return 'rendering';
      if (hasCharacteristics) return 'applying';
      return 'loading';
    };

    const loadingState = getLoadingState();

    // Enhanced preview text based on loading state
    const getPreviewText = () => {
      switch (loadingState) {
        case 'loaded':
          if (characteristics.isMonospace) return 'Code Example { }';
          if (characteristics.isSerif) return 'Elegant Typography';
          if (characteristics.weight >= 700) return 'Bold Example Style';
          if (characteristics.style === 'italic') return 'Italic Example Style';
          return 'Example Style';
        case 'rendering':
          return 'Applying font...';
        case 'applying':
          return 'Loading font...';
        default:
          return 'Preparing font...';
      }
    };

    // ✅ ENHANCED: Progressive loading indicator
    const LoadingIndicator = () => {
      if (loadingState === 'loaded') return null;
      
      const getLoadingMessage = () => {
        switch (loadingState) {
          case 'rendering': return 'Almost ready...';
          case 'applying': return 'Applying font...';
          default: return 'Loading font...';
        }
      };
      
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
          <div className="animate-spin rounded-full h-3 w-3 border border-gray-300 border-t-blue-500"></div>
          <span>{getLoadingMessage()}</span>
        </div>
      );
    };

    // Font information display
    const FontInfo = () => {
      if (!isVisible || !characteristics) return null;
      
      const getTypeInfo = () => {
        const types = [];
        if (characteristics.isSerif) types.push('Serif');
        if (characteristics.isMonospace) types.push('Monospace');
        if (!characteristics.isSerif && !characteristics.isMonospace) types.push('Sans-serif');
        return types.join(', ');
      };

      return (
        <div className="mt-1 text-xs text-gray-500 space-y-1">
          <div>{fontFamily}</div>
          <div>
            {getTypeInfo()} • Weight: {characteristics.weight} • Style: {characteristics.style}
          </div>
        </div>
      );
    };

    return (
      <div className="font-preview-container">
        <div 
          ref={previewRef}
          key={renderKey}
          style={getPreviewStyle()}
          className="font-preview-text"
        >
          {getPreviewText()}
        </div>
        
        {/* Progressive loading indicator */}
        <LoadingIndicator />
        
        {/* Font information */}
        <FontInfo />
      </div>
    );
  };

  if (fonts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Fonts</h2>
        <p className="text-gray-600 mb-6">Browse a list of fonts to build your font group.</p>
        
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
          <p className="text-gray-500">No fonts uploaded yet. Upload your first TTF font above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Fonts</h2>
      <p className="text-gray-600 mb-6">Browse a list of fonts to build your font group.</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Font Name
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Preview
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
                <td className="py-4 px-4 min-w-[400px]">
                  <DynamicFontPreview font={font} />
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