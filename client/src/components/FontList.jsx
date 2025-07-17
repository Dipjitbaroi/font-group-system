import React, { useState } from 'react';

// SOLID Principle: Single Responsibility - Only handles displaying fonts
const FontList = ({ fonts, onDeleteFont, loadedFonts }) => {
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

  const FontPreview = ({ font }) => {
    const fontFamily = font.name.replace(/\s+/g, '');
    const isLoaded = loadedFonts.includes(fontFamily);

    return (
      <span 
        className="font-preview text-gray-600"
        style={{ 
          fontFamily: isLoaded ? fontFamily : 'inherit',
          fontStyle: isLoaded ? 'normal' : 'italic'
        }}
      >
        {isLoaded ? 'Example Style' : 'Loading...'}
      </span>
    );
  };

  if (fonts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Fonts</h2>
        <p className="text-gray-600 mb-6">Browse a list of Zepto fonts to build your font group.</p>
        
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
      <p className="text-gray-600 mb-6">Browse a list of Zepto fonts to build your font group.</p>
      
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
                  <span className="text-gray-800 font-medium">{font.name}</span>
                </td>
                <td className="py-4 px-4">
                  <FontPreview font={font} />
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
