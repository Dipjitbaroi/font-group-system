import React, { useState, useEffect, useCallback } from 'react';
import FontUploader from './components/FontUploader.jsx';
import FontList from './components/FontList.jsx';
import FontGroupCreator from './components/FontGroupCreator.jsx';
import FontGroupsList from './components/FontGroupsList.jsx';
import { fontService, groupService } from './services/api';

// SOLID Principle: Single Responsibility - Main application container
function App() {
  const [fonts, setFonts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadedFonts, setLoadedFonts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Callback functions - declared before useEffect hooks
  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(''), 5000); // Clear error after 5 seconds
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [fontsData, groupsData] = await Promise.all([
        fontService.getAllFonts(),
        groupService.getAllGroups()
      ]);
      
      setFonts(fontsData);
      setGroups(groupsData);
    } catch (error) {
      showError('Failed to load initial data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadFontsIntoDOM = useCallback(() => {
    const newLoadedFonts = [];
    
    fonts.forEach(font => {
      const fontFamily = font.name.replace(/\s+/g, '');
      
      // Check if font is already loaded
      if (loadedFonts.includes(fontFamily)) {
        newLoadedFonts.push(fontFamily);
        return;
      }

      // Create font face
      const fontFace = new FontFace(fontFamily, `url(http://localhost:5000${font.path})`);
      
      fontFace.load().then(() => {
        document.fonts.add(fontFace);
        newLoadedFonts.push(fontFamily);
        setLoadedFonts(prev => [...prev, fontFamily]);
      }).catch(error => {
        console.error(`Failed to load font ${font.name}:`, error);
      });
    });
  }, [fonts, loadedFonts]);

  // Effects - now declared after the callback functions
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadFontsIntoDOM();
  }, [loadFontsIntoDOM]);

  // Font handlers
  const handleFontUpload = async (file) => {
    try {
      const uploadedFont = await fontService.uploadFont(file);
      setFonts(prev => [...prev, uploadedFont]);
      return uploadedFont;
    } catch (error) {
      throw new Error('Failed to upload font: ' + error.message);
    }
  };

  const handleFontDelete = async (filename) => {
    try {
      await fontService.deleteFont(filename);
      setFonts(prev => prev.filter(font => font.filename !== filename));
      
      // Remove from loaded fonts
      const fontToRemove = fonts.find(font => font.filename === filename);
      if (fontToRemove) {
        const fontFamily = fontToRemove.name.replace(/\s+/g, '');
        setLoadedFonts(prev => prev.filter(f => f !== fontFamily));
      }
    } catch (error) {
      throw new Error('Failed to delete font: ' + error.message);
    }
  };

  // Group handlers
  const handleGroupCreate = async (groupData) => {
    try {
      const createdGroup = await groupService.createGroup(groupData);
      setGroups(prev => [...prev, createdGroup]);
      return createdGroup;
    } catch (error) {
      throw new Error('Failed to create group: ' + error.message);
    }
  };

  const handleGroupEdit = async (groupId, groupData) => {
    try {
      const updatedGroup = await groupService.updateGroup(groupId, groupData);
      setGroups(prev => prev.map(group => 
        group.id === groupId ? updatedGroup : group
      ));
      return updatedGroup;
    } catch (error) {
      throw new Error('Failed to update group: ' + error.message);
    }
  };

  const handleGroupDelete = async (groupId) => {
    try {
      await groupService.deleteGroup(groupId);
      setGroups(prev => prev.filter(group => group.id !== groupId));
    } catch (error) {
      throw new Error('Failed to delete group: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Font Group System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Font Group System</h1>
          <p className="mt-2 text-gray-600">Upload fonts and create organized font groups</p>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Font Upload Section */}
        <FontUploader
          onFontUploaded={handleFontUpload}
          onError={showError}
        />

        {/* Font List Section */}
        <FontList
          fonts={fonts}
          loadedFonts={loadedFonts}
          onDeleteFont={handleFontDelete}
        />

        {/* Font Group Creator Section */}
        <FontGroupCreator
          fonts={fonts}
          onCreateGroup={handleGroupCreate}
          onError={showError}
        />

        {/* Font Groups List Section */}
        <FontGroupsList
          groups={groups}
          fonts={fonts}
          onEditGroup={handleGroupEdit}
          onDeleteGroup={handleGroupDelete}
          onError={showError}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Font Group System - Built with React.js and Node.js following SOLID principles
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
