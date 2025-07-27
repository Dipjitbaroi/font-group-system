import opentype from 'opentype.js';

/**
 * Extract font metadata from a TTF file
 * @param {File} file - The TTF file to analyze
 * @returns {Promise<Object>} Font metadata object
 */
export const extractFontMetadata = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const font = opentype.parse(arrayBuffer);
    
    // Debug: Log the font object structure
    console.log('Font object:', font);
    console.log('Font names:', font.names);
    
    // Helper function to get name from different possible formats
    const getName = (nameObj) => {
      if (!nameObj) return 'Unknown';
      
      // Try different language codes and formats
      return nameObj.en || 
             nameObj['en'] || 
             nameObj[1] || 
             nameObj['1'] || 
             nameObj[0] || 
             nameObj['0'] ||
             (typeof nameObj === 'string' ? nameObj : 'Unknown');
    };
    
    // Extract various font names and metadata with better fallback logic
    const metadata = {
      familyName: getName(font.names.fontFamily) || 
                  getName(font.names.preferredFamily) || 
                  font.familyName || 
                  'Unknown',
      fullName: getName(font.names.fullName) || 
                getName(font.names.fontFamily) || 
                font.fullName || 
                'Unknown',
      subfamilyName: getName(font.names.fontSubfamily) || 
                     getName(font.names.preferredSubfamily) || 
                     font.subfamilyName || 
                     'Regular',
      postscriptName: getName(font.names.postscriptName) || 
                      font.postscriptName || 
                      'Unknown',
      designer: getName(font.names.designer) || 
                getName(font.names.designerURL) || 
                'Unknown',
      version: getName(font.names.version) || 
               font.version || 
               'Unknown',
      manufacturer: getName(font.names.manufacturer) || 'Unknown',
      copyright: getName(font.names.copyright) || 'Unknown',
      // Additional technical metadata
      unitsPerEm: font.unitsPerEm || 1000,
      ascender: font.ascender || 0,
      descender: font.descender || 0,
      numGlyphs: font.numGlyphs || 0,
      // File information
      filename: file.name,
      fileSize: file.size,
      lastModified: file.lastModified
    };

    console.log('Extracted metadata:', metadata);
    return metadata;
  } catch (error) {
    console.error('Error parsing font file:', error);
    console.error('Error details:', error.stack);
    throw new Error(`Failed to parse font file: ${error.message}`);
  }
};

/**
 * Validate if a file is a valid TTF font
 * @param {File} file - The file to validate
 * @returns {boolean} True if valid TTF file
 */
export const isValidTTFFile = (file) => {
  if (!file) return false;
  
  const validExtensions = ['.ttf', '.otf'];
  const fileName = file.name.toLowerCase();
  
  return validExtensions.some(ext => fileName.endsWith(ext));
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get display name for font (prioritizes family name over filename)
 * @param {Object} fontData - Font data object
 * @returns {string} Display name
 */
export const getFontDisplayName = (fontData) => {
  if (fontData.metadata && fontData.metadata.familyName && fontData.metadata.familyName !== 'Unknown') {
    return fontData.metadata.familyName;
  }
  
  if (fontData.name && fontData.name !== fontData.filename) {
    return fontData.name;
  }
  
  // Fallback to filename without extension
  return fontData.filename ? fontData.filename.replace(/\.(ttf|otf)$/i, '') : 'Unknown Font';
};
