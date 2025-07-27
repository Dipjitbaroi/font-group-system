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
 * Check file magic bytes to verify it's actually a font file
 * @param {ArrayBuffer} buffer - File buffer to check
 * @returns {Object} Validation result with type and validity
 */
const checkFontMagicBytes = (buffer) => {
  const view = new DataView(buffer);
  
  // Check for TTF signature (0x00010000)
  if (view.getUint32(0, false) === 0x00010000) {
    return { isValid: true, type: 'TTF', signature: '0x00010000' };
  }
  
  // Check for OTF signature ('OTTO')
  const ottoSignature = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (ottoSignature === 'OTTO') {
    return { isValid: true, type: 'OTF', signature: 'OTTO' };
  }
  
  // Check for other possible font signatures
  const firstFourBytes = Array.from(new Uint8Array(buffer, 0, 4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return { 
    isValid: false, 
    type: 'Unknown', 
    signature: `0x${firstFourBytes}`,
    error: 'File does not have a valid font signature'
  };
};

/**
 * Validate font file structure and required tables
 * @param {Object} font - Parsed font object from opentype.js
 * @returns {Object} Validation result
 */
const validateFontStructure = (font) => {
  // Only check for the most essential tables - be more lenient
  const criticalTables = ['head', 'cmap'];
  const missingCriticalTables = [];
  
  // Check for critical font tables only
  criticalTables.forEach(table => {
    if (!font.tables || !font.tables[table]) {
      missingCriticalTables.push(table);
    }
  });
  
  if (missingCriticalTables.length > 0) {
    return {
      isValid: false,
      error: `Missing critical font tables: ${missingCriticalTables.join(', ')}`
    };
  }
  
  // Check if font has glyphs (be more lenient)
  if (!font.glyphs && font.numGlyphs === 0) {
    return {
      isValid: false,
      error: 'Font contains no glyphs'
    };
  }
  
  // Check if font has basic metrics (be more lenient)
  if (!font.unitsPerEm || font.unitsPerEm <= 0) {
    return {
      isValid: false,
      error: 'Font has invalid units per em'
    };
  }
  
  return { isValid: true };
};

/**
 * Comprehensive font file validation
 * @param {File} file - The file to validate
 * @returns {Promise<Object>} Validation result
 */
export const validateFontFile = async (file) => {
  const validationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
  };
  
  try {
    // 1. Basic file checks
    if (!file) {
      validationResult.errors.push('No file provided');
      return validationResult;
    }
    
    // 2. File extension validation
    const validExtensions = ['.ttf', '.otf'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      validationResult.errors.push('File must have .ttf or .otf extension');
    }
    
    // 3. File size validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    const minSize = 1024; // 1KB minimum
    
    if (file.size > maxSize) {
      validationResult.errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (10MB)`);
    }
    
    if (file.size < minSize) {
      validationResult.errors.push(`File size (${formatFileSize(file.size)}) is too small to be a valid font file`);
    }
    
    // 4. MIME type validation (if available)
    const validMimeTypes = ['font/ttf', 'font/otf', 'application/font-sfnt', 'application/x-font-ttf'];
    if (file.type && !validMimeTypes.includes(file.type)) {
      validationResult.warnings.push(`Unexpected MIME type: ${file.type}`);
    }
    
    // 5. Read file buffer for binary validation
    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (error) {
      validationResult.errors.push('Failed to read file content');
      return validationResult;
    }
    
    // 6. Magic bytes validation
    const magicBytesResult = checkFontMagicBytes(arrayBuffer);
    if (!magicBytesResult.isValid) {
      validationResult.errors.push(magicBytesResult.error);
      validationResult.fileInfo.detectedSignature = magicBytesResult.signature;
    } else {
      validationResult.fileInfo.fontType = magicBytesResult.type;
      validationResult.fileInfo.signature = magicBytesResult.signature;
    }
    
    // 7. Font parsing validation
    let font;
    try {
      font = opentype.parse(arrayBuffer);
    } catch (error) {
      validationResult.errors.push(`Font parsing failed: ${error.message}`);
      return validationResult;
    }
    
    // 8. Font structure validation
    const structureResult = validateFontStructure(font);
    if (!structureResult.isValid) {
      validationResult.errors.push(structureResult.error);
    }
    
    // 9. Font metadata validation
    if (!font.names || Object.keys(font.names).length === 0) {
      validationResult.warnings.push('Font has no name table or metadata');
    }
    
    // 10. Additional checks
    if (font.numGlyphs < 10) {
      validationResult.warnings.push(`Font has very few glyphs (${font.numGlyphs})`);
    }
    
    if (!font.names.fontFamily) {
      validationResult.warnings.push('Font family name not found in metadata');
    }
    
    // Set overall validation result
    validationResult.isValid = validationResult.errors.length === 0;
    validationResult.fontObject = font; // Include parsed font for further use
    
    return validationResult;
    
  } catch (error) {
    validationResult.errors.push(`Validation failed: ${error.message}`);
    return validationResult;
  }
};

/**
 * Simple file extension validation (kept for backward compatibility)
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
