import React, { useState } from 'react';
import './NewTreeModal.css';

interface NewTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (treeName: string) => void;
}

const NewTreeModal: React.FC<NewTreeModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [treeName, setTreeName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (treeName.trim()) {
      onSubmit(treeName.trim());
      setTreeName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Create New Tree</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tree Name</label>
            <input
              type="text"
              value={treeName}
              onChange={(e) => setTreeName(e.target.value)}
              placeholder="e.g., Smith Family"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn-create">Create</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTreeModal;
