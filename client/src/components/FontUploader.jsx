import React, { useState, useRef } from 'react';
import { extractFontMetadata, isValidTTFFile, formatFileSize } from '../utils/fontUtils';

// SOLID Principle: Single Responsibility - Only handles font uploading
const FontUploader = ({ onFontUploaded, onError }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFont, setSelectedFont] = useState(null);
  const [fontMetadata, setFontMetadata] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!isValidTTFFile(file)) {
      throw new Error('Only TTF and OTF files are allowed');
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File size must be less than 10MB');
    }
  };

  const handleFileSelection = async (file) => {
    try {
      validateFile(file);
      setSelectedFont(file);
      
      // Extract font metadata
      const metadata = await extractFontMetadata(file);
      setFontMetadata(metadata);
      
    } catch (error) {
      onError(error.message);
      setSelectedFont(null);
      setFontMetadata(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFont || !fontMetadata) {
      onError('No font selected');
      return;
    }

    try {
      setIsUploading(true);
      
      // Pass both file and metadata to parent
      await onFontUploaded(selectedFont, fontMetadata);
      
      // Reset state
      setSelectedFont(null);
      setFontMetadata(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectedFont(null);
    setFontMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleClick = () => {
    if (!selectedFont && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      {!selectedFont ? (
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
            
            <div className="text-center">
              <p className="text-lg text-gray-600 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                TTF and OTF files allowed (Max 10MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Font Preview */}
          <div className="bg-gray-50 rounded-lg p-6 border">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {fontMetadata?.familyName || 'Loading...'}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Full Name:</span> {fontMetadata?.fullName || 'Loading...'}
                  </div>
                  <div>
                    <span className="font-medium">Style:</span> {fontMetadata?.subfamilyName || 'Loading...'}
                  </div>
                  <div>
                    <span className="font-medium">File Size:</span> {formatFileSize(selectedFont.size)}
                  </div>
                  <div>
                    <span className="font-medium">Designer:</span> {fontMetadata?.designer || 'Unknown'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCancelSelection}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                title="Cancel selection"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Font Preview Text */}
            <div className="bg-white rounded p-4 border">
              <p className="text-gray-500 text-sm mb-2">Preview:</p>
              <div 
                className="text-2xl text-gray-900"
                style={{ fontFamily: `"${fontMetadata?.familyName}", serif` }}
              >
                The quick brown fox jumps over the lazy dog
              </div>
              <div 
                className="text-sm text-gray-600 mt-2"
                style={{ fontFamily: `"${fontMetadata?.familyName}", serif` }}
              >
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 1234567890
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleFileUpload}
              disabled={isUploading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isUploading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : (
                'Upload Font'
              )}
            </button>
            <button
              onClick={handleCancelSelection}
              disabled={isUploading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FontUploader;
