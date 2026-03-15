import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTree } from '../../hooks/useTree';
import { useUI } from '../../hooks/useUI';
import LoginButton from '../LoginButton/LoginButton';
import NewTreeModal from '../NewTreeModal/NewTreeModal';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const { trees, createTree } = useTree();
  const { newTreeModalOpen, openNewTreeModal, closeNewTreeModal } = useUI();
  const navigate = useNavigate();

  const publicTrees = trees.filter(t => t.isPublic);

  const handleCreateTree = async (treeName: string) => {
    const newTreeId = await createTree(treeName);
    navigate(`/tree/${newTreeId}`);
  };

  const handlePublicTreeClick = (treeId: string) => {
    navigate(`/tree/${treeId}`);
  };

  return (
    <div className="landing-page">
      <div className="landing-header">
        <LoginButton variant="landing" />
      </div>

      <div className="landing-content">
        <div className="landing-logo">Family Tree</div>
        <p className="landing-subtitle">
          Create, view, and manage your family history
        </p>

        <button className="landing-create-btn" onClick={openNewTreeModal}>
          + Create New Tree
        </button>

        {publicTrees.length > 0 && (
          <div className="landing-public-section">
            <div className="landing-divider">
              <span>or explore public trees</span>
            </div>
            <div className="public-tree-list">
              {publicTrees.map(tree => (
                <button
                  key={tree.treeId}
                  className="public-tree-link"
                  onClick={() => handlePublicTreeClick(tree.treeId)}
                >
                  {tree.treeName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <NewTreeModal
        isOpen={newTreeModalOpen}
        onClose={closeNewTreeModal}
        onSubmit={handleCreateTree}
      />
    </div>
  );
};

export default LandingPage;
