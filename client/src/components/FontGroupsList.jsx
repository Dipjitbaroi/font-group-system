import React, { useState } from 'react';

// SOLID Principle: Single Responsibility - Only handles displaying and managing font groups
const FontGroupsList = ({ groups, fonts, onEditGroup, onDeleteGroup, onError }) => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [editFormData, setEditFormData] = useState({ title: '', fonts: [] });

  const handleEdit = (group) => {
    setEditingGroup(group.id);
    setEditFormData({
      title: group.title,
      fonts: group.fonts || []
    });
  };

  const handleCancelEdit = () => {
    setEditingGroup(null);
    setEditFormData({ title: '', fonts: [] });
  };

  const handleSaveEdit = async () => {
    try {
      if (!editFormData.title.trim()) {
        throw new Error('Group title is required');
      }

      if (editFormData.fonts.length < 2) {
        throw new Error('Group must have at least 2 fonts');
      }

      await onEditGroup(editingGroup, editFormData);
      setEditingGroup(null);
      setEditFormData({ title: '', fonts: [] });
    } catch (error) {
      onError(error.message);
    }
  };

  const handleDelete = async (groupId) => {
    try {
      setDeletingGroup(groupId);
      await onDeleteGroup(groupId);
    } catch (error) {
      onError(error.message);
    } finally {
      setDeletingGroup(null);
    }
  };

  const updateEditFormFont = (index, field, value) => {
    const updatedFonts = editFormData.fonts.map((font, i) => 
      i === index ? { ...font, [field]: value } : font
    );
    setEditFormData({ ...editFormData, fonts: updatedFonts });
  };

  const addEditFormFont = () => {
    setEditFormData({
      ...editFormData,
      fonts: [...editFormData.fonts, { name: '', selectedFont: '' }]
    });
  };

  const removeEditFormFont = (index) => {
    if (editFormData.fonts.length > 2) {
      const updatedFonts = editFormData.fonts.filter((_, i) => i !== index);
      setEditFormData({ ...editFormData, fonts: updatedFonts });
    }
  };

  const getAvailableFontsForEdit = (currentIndex) => {
    const selectedFonts = editFormData.fonts
      .filter((_, i) => i !== currentIndex && _.selectedFont)
      .map(font => font.selectedFont);
    
    return fonts.filter(font => !selectedFonts.includes(font.id));
  };

  const getFontNameById = (fontId) => {
    const font = fonts.find(f => f.id === fontId);
    return font ? font.name : fontId;
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Font Groups</h2>
        <p className="text-gray-600 mb-6">List of all available font groups.</p>
        
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-gray-500">No font groups created yet. Create your first group above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Our Font Groups</h2>
      <p className="text-gray-600 mb-6">List of all available font groups.</p>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Name
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Fonts
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Count
              </th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((group) => (
              <tr key={group.id} className="hover:bg-gray-50 transition-colors duration-150">
                {editingGroup === group.id ? (
                  <td colSpan="4" className="py-4 px-4">
                    <div className="space-y-4">
                      {/* Edit Title */}
                      <div>
                        <input
                          type="text"
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="Group Title"
                        />
                      </div>

                      {/* Edit Fonts */}
                      <div className="space-y-2">
                        {editFormData.fonts.map((font, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={font.name}
                              onChange={(e) => updateEditFormFont(index, 'name', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                              placeholder="Font Name"
                            />
                            <select
                              value={font.selectedFont}
                              onChange={(e) => updateEditFormFont(index, 'selectedFont', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                            >
                              <option value="">Select a Font</option>
                              {getAvailableFontsForEdit(index).map((availableFont) => (
                                <option key={availableFont.id} value={availableFont.id}>
                                  {availableFont.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeEditFormFont(index)}
                              disabled={editFormData.fonts.length <= 2}
                              className={`p-2 rounded-md ${
                                editFormData.fonts.length <= 2
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addEditFormFont}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          + Add Font
                        </button>
                      </div>

                      {/* Edit Actions */}
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="py-4 px-4">
                      <span className="text-gray-800 font-medium">{group.title}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-600">
                        {group.fonts && group.fonts.length > 0
                          ? group.fonts.map(font => getFontNameById(font.selectedFont)).join(', ')
                          : 'No fonts'
                        }
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-600">
                        {group.fonts ? group.fonts.length : 0}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end space-x-4">
                        <button
                          onClick={() => handleEdit(group)}
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors duration-150"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          disabled={deletingGroup === group.id}
                          className="text-red-600 hover:text-red-800 font-medium hover:underline transition-colors duration-150 disabled:opacity-50"
                        >
                          {deletingGroup === group.id ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              <span>Deleting...</span>
                            </div>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FontGroupsList;
