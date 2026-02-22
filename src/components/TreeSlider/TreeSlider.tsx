import React, { useState, useEffect } from 'react';
import './TreeSlider.css';

interface TreeSliderProps {
  isOpen: boolean;
  onClose: () => void;
  treeName: string;
  isPublic: boolean;
  onSave: (name: string, isPublic: boolean) => void;
}

const TreeSlider: React.FC<TreeSliderProps> = ({
  isOpen,
  onClose,
  treeName,
  isPublic,
  onSave
}) => {
  const [name, setName] = useState(treeName);
  const [publicFlag, setPublicFlag] = useState(isPublic);

  useEffect(() => {
    setName(treeName);
    setPublicFlag(isPublic);
  }, [treeName, isPublic, isOpen]);

  const hasChanges = name !== treeName || publicFlag !== isPublic;

  const handleOverlayClick = () => {
    if (!hasChanges) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), publicFlag);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="slider-overlay open" onClick={handleOverlayClick}>
      <div className="slider-panel tree-slider" onClick={(e) => e.stopPropagation()}>
        <div className="slider-header">
          <h3>Edit Family Tree</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="slider-form">
          <div className="form-group">
            <label>Tree Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tree name"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="toggle-label">
              <span>Visibility</span>
            </label>
            <div className="visibility-options">
              <button
                type="button"
                className={`visibility-btn ${!publicFlag ? 'active' : ''}`}
                onClick={() => setPublicFlag(false)}
              >
                🏠 Private
              </button>
              <button
                type="button"
                className={`visibility-btn ${publicFlag ? 'active' : ''}`}
                onClick={() => setPublicFlag(true)}
              >
                🌐 Public
              </button>
            </div>
            <p className="visibility-hint">
              {publicFlag 
                ? 'Public trees are visible to everyone.' 
                : 'Private trees are only visible to you.'}
            </p>
          </div>

          <div className="slider-actions">
            <button type="submit" className="btn-save">Save Changes</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TreeSlider;
