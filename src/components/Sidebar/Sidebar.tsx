import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FamilyTree, Person } from '../../types';
import { useTree } from '../../hooks/useTree';
import { useNavigation } from '../../hooks/useNavigation';
import { useUI } from '../../hooks/useUI';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import TreeSlider from '../TreeSlider/TreeSlider';
import './Sidebar.css';

const MEMBERS_PER_PAGE = 10;

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

const Sidebar: React.FC = () => {
  const { trees, currentTree, importTree, downloadCurrentTree, deleteTree, updateTree } = useTree();
  const { mainPersonId, setMainPerson } = useNavigation();
  const { openNewTreeModal, closeMobilePanelRef } = useUI();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memberPage, setMemberPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [deleteConfirm, setDeleteConfirm] = useState<{ treeId: string; treeName: string } | null>(null);
  const [editingTree, setEditingTree] = useState<{ treeId: string; treeName: string; isPublic: boolean } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'trees' | 'members'>('none');
  const isMobile = useIsMobile();

  const currentTreeId = currentTree?.treeId || null;

  React.useEffect(() => {
    if (closeMobilePanelRef) {
      closeMobilePanelRef.current = () => setMobilePanel('none');
    }
  }, [closeMobilePanelRef]);

  const handleSelectTree = (treeId: string) => {
    navigate(`/tree/${treeId}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const tree = JSON.parse(event.target?.result as string) as FamilyTree;
        importTree(tree);
        if (tree.isPublic && activeTab === 'my') {
          setActiveTab('public');
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const members = currentTree?.treeData || [];
  const totalPages = Math.ceil(members.length / MEMBERS_PER_PAGE);
  const paginatedMembers = members.slice(
    memberPage * MEMBERS_PER_PAGE,
    (memberPage + 1) * MEMBERS_PER_PAGE
  );

  React.useEffect(() => {
    setMemberPage(0);
  }, [currentTreeId]);

  const myTrees = trees.filter(t => !t.isPublic);
  const publicTrees = trees.filter(t => t.isPublic);
  const displayedTrees = activeTab === 'my' ? myTrees : publicTrees;

  const sidebarClasses = [
    'sidebar',
    mobilePanel === 'trees' ? 'panel-open' : '',
    mobilePanel === 'members' ? 'members-panel-open' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={sidebarClasses}>
      {isMobile && mobilePanel !== 'none' && (
        <div className="mobile-panel-close" onClick={() => setMobilePanel('none')}>
          <div className="drag-handle" />
        </div>
      )}

      <div className="sidebar-header">
        <h2>Family Trees</h2>
      </div>
      
      <div className="sidebar-actions">
        <button className="btn-new" onClick={openNewTreeModal}>+ New Tree</button>
        <button className="btn-import" onClick={handleImportClick}>Import Tree</button>
        <button className="btn-open-file" onClick={async () => {
          try {
            const [fileHandle] = await (window as any).showOpenFilePicker({
              types: [
                {
                  description: 'JSON Files',
                  accept: { 'application/json': ['.json'] },
                },
              ],
            });
            const file = await fileHandle.getFile();
            const contents = await file.text();
            const tree = JSON.parse(contents) as FamilyTree;
            tree.fileHandle = fileHandle;
            importTree(tree);
          } catch (err) {
            console.error(err);
          }
        }}>Open File</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div className="tree-tabs">
        <button 
          className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          My Trees ({myTrees.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'public' ? 'active' : ''}`}
          onClick={() => setActiveTab('public')}
        >
          Public ({publicTrees.length})
        </button>
      </div>

      <div className="tree-list">
        {displayedTrees.length === 0 ? (
          <div className="no-trees">
            {activeTab === 'my' 
              ? 'No trees yet. Create one or import a JSON file.'
              : 'No public trees available.'}
          </div>
        ) : (
          displayedTrees.map((tree) => (
            <div
              key={tree.treeId}
              className={`tree-item ${currentTreeId === tree.treeId ? 'active' : ''}`}
              onClick={() => handleSelectTree(tree.treeId)}
            >
              <span className="tree-icon">{tree.isPublic ? '🌐' : '🏠'}</span>
              <span className="tree-name" title={tree.treeName}>
                {tree.treeName.length > 25 ? tree.treeName.substring(0, 25) + '...' : tree.treeName}
              </span>
              <div className="tree-actions">
                <button
                  className="btn-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTree({ treeId: tree.treeId, treeName: tree.treeName, isPublic: !!tree.isPublic });
                  }}
                  title="Edit"
                >
                  ✎
                </button>
                {currentTreeId === tree.treeId && (
                  <button
                    className="btn-download"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadCurrentTree();
                    }}
                    title="Download JSON"
                  >
                    ↓
                  </button>
                )}
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({ treeId: tree.treeId, treeName: tree.treeName });
                  }}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {currentTree && currentTree.treeData.length > 0 && (
        <div className="members-section">
          <div className="members-header">
            <h3>Members ({members.length})</h3>
          </div>
          
          <div className="members-list">
            {paginatedMembers.map((person: Person) => (
              <div
                key={person.personId}
                className={`member-item ${mainPersonId === person.personId ? 'active' : ''}`}
                onClick={() => setMainPerson(person.personId)}
              >
                <span className={`member-gender ${person.gender}`}>
                  {person.gender === 'male' ? '♂' : '♀'}
                </span>
                <span className="member-name">
                  {person.firstName} {person.lastName}
                </span>
                {mainPersonId === person.personId && (
                  <span className="main-indicator">★</span>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="members-pagination">
              <button
                disabled={memberPage === 0}
                onClick={() => setMemberPage(p => p - 1)}
              >
                ‹
              </button>
              <span>{memberPage + 1} / {totalPages}</span>
              <button
                disabled={memberPage >= totalPages - 1}
                onClick={() => setMemberPage(p => p + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Remove Tree"
        message={`"${deleteConfirm?.treeName}" will be removed. You may want to download a copy first.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (deleteConfirm) {
            deleteTree(deleteConfirm.treeId);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <TreeSlider
        isOpen={editingTree !== null}
        onClose={() => setEditingTree(null)}
        treeName={editingTree?.treeName || ''}
        isPublic={editingTree?.isPublic || false}
        onSave={(name, isPublic) => {
          if (editingTree) {
            updateTree(editingTree.treeId, name, isPublic);
            if (isPublic && activeTab === 'my') {
              setActiveTab('public');
            } else if (!isPublic && activeTab === 'public') {
              setActiveTab('my');
            }
          }
        }}
      />

      {isMobile && (
        <div className="mobile-tab-bar">
          <button
            className={`mobile-tab-btn ${mobilePanel === 'trees' ? 'active' : ''}`}
            onClick={() => setMobilePanel(mobilePanel === 'trees' ? 'none' : 'trees')}
          >
            <span className="tab-icon">🌳</span>
            <span className="tab-label">Trees</span>
          </button>
          <button
            className={`mobile-tab-btn ${mobilePanel === 'members' ? 'active' : ''}`}
            onClick={() => setMobilePanel(mobilePanel === 'members' ? 'none' : 'members')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-label">Members</span>
          </button>
          <button className="mobile-tab-btn" onClick={openNewTreeModal}>
            <span className="tab-icon">＋</span>
            <span className="tab-label">New</span>
          </button>
          <button className="mobile-tab-btn" onClick={handleImportClick}>
            <span className="tab-icon">📥</span>
            <span className="tab-label">Import</span>
          </button>
          <button className="mobile-tab-btn" onClick={async () => {
            try {
              const [fileHandle] = await (window as any).showOpenFilePicker({
                types: [
                  {
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] },
                  },
                ],
              });
              const file = await fileHandle.getFile();
              const contents = await file.text();
              const tree = JSON.parse(contents) as FamilyTree;
              tree.fileHandle = fileHandle;
              importTree(tree);
            } catch (err) {
              console.error(err);
            }
          }}>
            <span className="tab-icon">📂</span>
            <span className="tab-label">Open</span>
          </button>
          {currentTree && (
            <button className="mobile-tab-btn" onClick={downloadCurrentTree}>
              <span className="tab-icon">📤</span>
              <span className="tab-label">Export</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
