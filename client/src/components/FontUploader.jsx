import React, { useState, useRef } from 'react';
import { extractFontMetadata, validateFontFile } from '../utils/fontUtils';

// SOLID Principle: Single Responsibility - Only handles font uploading
const FontUploader = ({ onFontUploaded, onError }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationStatus, setValidationStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileUpload = async (file) => {
    try {
      setIsUploading(true);
      setValidationStatus('Validating file...');
      
      // Comprehensive file validation
      const validationResult = await validateFontFile(file);
      
      if (!validationResult.isValid) {
        const errorMessage = validationResult.errors.join('; ');
        throw new Error(`File validation failed: ${errorMessage}`);
      }
      
      // Show warnings if any (but continue with upload)
      if (validationResult.warnings.length > 0) {
        console.warn('Font validation warnings:', validationResult.warnings);
      }
      
      setValidationStatus('Extracting font metadata...');
      
      // Extract font metadata (use the already parsed font from validation)
      let metadata;
      if (validationResult.fontObject) {
        // Use the font object from validation to avoid re-parsing
        metadata = await extractFontMetadataFromParsedFont(validationResult.fontObject, file);
      } else {
        // Fallback to regular extraction
        metadata = await extractFontMetadata(file);
      }
      
      setValidationStatus('Uploading font...');
      
      // Upload the validated font
      await onFontUploaded(file, metadata);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setValidationStatus('');
      
    } catch (error) {
      setValidationStatus('');
      onError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to extract metadata from already parsed font
  const extractFontMetadataFromParsedFont = async (font, file) => {
    const getName = (nameObj) => {
      if (!nameObj) return 'Unknown';
      return nameObj.en || 
             nameObj['en'] || 
             nameObj[1] || 
             nameObj['1'] || 
             nameObj[0] || 
             nameObj['0'] ||
             (typeof nameObj === 'string' ? nameObj : 'Unknown');
    };
    
    return {
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
      unitsPerEm: font.unitsPerEm || 1000,
      ascender: font.ascender || 0,
      descender: font.descender || 0,
      numGlyphs: font.numGlyphs || 0,
      filename: file.name,
      fileSize: file.size,
      lastModified: file.lastModified
    };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (isUploading) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div
        className={`
          drag-drop-area border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        <div className="flex flex-col items-center space-y-4">
          {isUploading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          ) : (
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
          
          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">
              {isUploading ? (validationStatus || 'Processing font...') : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-gray-500">
              {isUploading 
                ? 'Please wait while we validate and process your font' 
                : 'TTF and OTF files allowed (Max 10MB) • Files are validated for security'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontUploader;
