import React, { useState } from "react";
import { getFontDisplayName, formatFileSize } from '../utils/fontUtils';

// Responsible for rendering the uploaded fonts and handling preview/deletion
const FontList = ({ fonts, onDeleteFont, loadedFonts }) => {
  const [deletingFont, setDeletingFont] = useState(null);
  const [expandedFont, setExpandedFont] = useState(null);

  const handleDelete = async (font) => {
    try {
      setDeletingFont(font.filename);
      await onDeleteFont(font.filename);
    } catch (error) {
      console.error("Error deleting font:", error);
    } finally {
      setDeletingFont(null);
    }
  };

  const toggleExpanded = (fontId) => {
    setExpandedFont(expandedFont === fontId ? null : fontId);
  };

  // Renders individual font preview
  const FontPreview = ({ font }) => {
    const fontFamily = font.cssFontName || font.name.replace(/\s+/g, "");
    const isLoaded = loadedFonts.includes(fontFamily);

    return (
      <div className="space-y-2">
        <div
          className="text-lg text-gray-800"
          style={{
            fontFamily: isLoaded ? fontFamily : "inherit",
            fontStyle: isLoaded ? "normal" : "italic",
          }}
        >
          {isLoaded ? "Example Style" : "Loading font..."}
        </div>
      </div>
    );
  };

  if (fonts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Fonts</h2>
        <p className="text-gray-600 mb-6">
          Browse a list of Zepto fonts to build your font group.
        </p>

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
          <p className="text-gray-500">
            No fonts uploaded yet. Upload your first TTF font above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Fonts</h2>
      <p className="text-gray-600 mb-6">
        Browse a list of Zepto fonts to build your font group.
      </p>

      <div className="space-y-4">
        {fonts.map((font) => {
          const displayName = getFontDisplayName(font);
          const isExpanded = expandedFont === font.id;
          
          return (
            <div
              key={font.id}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-150"
            >
              {/* Font Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {displayName}
                  </h3>
                </div>
                {/* Font Preview */}
              <div className="mb-4">
                <FontPreview font={font} />
              </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleDelete(font)}
                    disabled={deletingFont === font.filename}
                    className={`text-red-600 hover:text-red-800 font-medium transition-colors duration-150 ${
                      deletingFont === font.filename
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:underline"
                    }`}
                  >
                    {deletingFont === font.filename ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        <span>Deleting...</span>
                      </div>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FontList;
