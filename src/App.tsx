import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useTree } from './hooks/useTree';
import { useUI } from './hooks/useUI';
import LandingPage from './components/LandingPage/LandingPage';
import Sidebar from './components/Sidebar/Sidebar';
import Canvas from './components/Canvas/Canvas';
import PersonSlider from './components/PersonSlider/PersonSlider';
import NewTreeModal from './components/NewTreeModal/NewTreeModal';
import './App.css';

function TreeViewInner() {
  const { treeId } = useParams<{ treeId: string }>();
  const { selectTree, createTree } = useTree();
  const { newTreeModalOpen, closeNewTreeModal } = useUI();
  const navigate = useNavigate();

  useEffect(() => {
    if (treeId) {
      selectTree(treeId);
    }
  }, [treeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateTree = async (treeName: string) => {
    const newTreeId = await createTree(treeName);
    navigate(`/tree/${newTreeId}`);
  };

  return (
    <div className="app-container">
      <Sidebar />
      <Canvas />
      <PersonSlider />
      <NewTreeModal
        isOpen={newTreeModalOpen}
        onClose={closeNewTreeModal}
        onSubmit={handleCreateTree}
      />
    </div>
  );
}

function App() {
  const { trees, lastOpenedTreeId, isInitialized } = useTree();

  if (!isInitialized) {
    return null;
  }

  const hasLocalTrees = trees.some(t => !t.isPublic);

  return (
    <Routes>
      <Route path="/" element={
        hasLocalTrees && lastOpenedTreeId
          ? <Navigate to={`/tree/${lastOpenedTreeId}`} replace />
          : <LandingPage />
      } />
      <Route path="/tree/:treeId" element={<TreeViewInner />} />
    </Routes>
  );
}

export default App;
