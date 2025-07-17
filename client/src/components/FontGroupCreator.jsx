import React, { useState } from 'react';

// SOLID Principle: Single Responsibility - Only handles creating font groups
const FontGroupCreator = ({ fonts, onCreateGroup, onError }) => {
  const [groupTitle, setGroupTitle] = useState('');
  const [fontRows, setFontRows] = useState([{ id: 1, fontName: '', selectedFont: '' }]);
  const [isCreating, setIsCreating] = useState(false);

  const addRow = () => {
    const newId = Math.max(...fontRows.map(row => row.id)) + 1;
    setFontRows([...fontRows, { id: newId, fontName: '', selectedFont: '' }]);
  };

  const removeRow = (id) => {
    if (fontRows.length > 1) {
      setFontRows(fontRows.filter(row => row.id !== id));
    }
  };

  const updateRow = (id, field, value) => {
    setFontRows(fontRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const validateForm = () => {
    if (!groupTitle.trim()) {
      throw new Error('Group title is required');
    }

    const validRows = fontRows.filter(row => row.selectedFont && row.fontName.trim());
    
    if (validRows.length < 2) {
      throw new Error('You must select at least two fonts to create a group');
    }

    // Check for duplicate font selections
    const selectedFonts = validRows.map(row => row.selectedFont);
    const uniqueFonts = new Set(selectedFonts);
    if (uniqueFonts.size !== selectedFonts.length) {
      throw new Error('Cannot select the same font multiple times');
    }

    return validRows;
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      const validRows = validateForm();

      const groupData = {
        title: groupTitle.trim(),
        fonts: validRows.map(row => ({
          name: row.fontName.trim(),
          selectedFont: row.selectedFont
        }))
      };

      await onCreateGroup(groupData);

      // Reset form
      setGroupTitle('');
      setFontRows([{ id: 1, fontName: '', selectedFont: '' }]);
    } catch (error) {
      onError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const getAvailableFonts = (currentRowId) => {
    const selectedFonts = fontRows
      .filter(row => row.id !== currentRowId && row.selectedFont)
      .map(row => row.selectedFont);
    
    return fonts.filter(font => !selectedFonts.includes(font.id));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Font Group</h2>
      <p className="text-gray-600 mb-6">You have to select at least two fonts</p>

      {/* Group Title */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Group Title"
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
          disabled={isCreating}
        />
      </div>

      {/* Font Rows */}
      <div className="space-y-4 mb-6">
        {fontRows.map((row, index) => (
          <div key={row.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            {/* Drag Handle */}
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
              </svg>
            </div>

            {/* Font Name Input */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Font Name"
                value={row.fontName}
                onChange={(e) => updateRow(row.id, 'fontName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={isCreating}
              />
            </div>

            {/* Font Selection Dropdown */}
            <div className="flex-1">
              <select
                value={row.selectedFont}
                onChange={(e) => updateRow(row.id, 'selectedFont', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                disabled={isCreating}
              >
                <option value="">Select a Font</option>
                {getAvailableFonts(row.id).map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => removeRow(row.id)}
                disabled={fontRows.length <= 1 || isCreating}
                className={`
                  p-2 rounded-md transition-colors duration-200
                  ${fontRows.length <= 1 || isCreating
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                  }
                `}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={addRow}
          disabled={isCreating}
          className="flex items-center space-x-2 px-4 py-2 border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Row</span>
        </button>

        <button
          onClick={handleCreate}
          disabled={isCreating || fonts.length === 0}
          className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Creating...</span>
            </>
          ) : (
            <span>Create</span>
          )}
        </button>
      </div>

      {fonts.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            You need to upload at least 2 fonts before creating a group.
          </p>
        </div>
      )}
    </div>
  );
};

export default FontGroupCreator;
