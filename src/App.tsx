import { useState, useEffect, useCallback } from 'react';
import { FamilyTree, Person } from './types';
import Sidebar from './components/Sidebar/Sidebar';
import Canvas from './components/Canvas/Canvas';
import PersonSlider from './components/PersonSlider/PersonSlider';
import NewTreeModal from './components/NewTreeModal/NewTreeModal';
import {
  getTreeList,
  getTree,
  saveTree,
  deleteTree,
  getCurrentTreeId,
  setCurrentTreeId,
  downloadTree,
  createEmptyTree,
  generateTreeId
} from './utils/storage';
import './App.css';

const MAIN_PERSON_KEY = 'mainPersonId_';

function App() {
  const [trees, setTrees] = useState<ReturnType<typeof getTreeList>>([]);
  const [currentTree, setCurrentTree] = useState<FamilyTree | null>(null);
  const [mainPersonId, setMainPersonId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [relationContext, setRelationContext] = useState<{ parentId: string; relation: 'child' | 'parent' | 'spouse' } | undefined>();
  const [newTreeModalOpen, setNewTreeModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSiblings, setShowSiblings] = useState(true);
  const [showCousins, setShowCousins] = useState(false);
  const [showFullTree, setShowFullTree] = useState(false);

  useEffect(() => {
    loadTrees();
  }, []);

  const loadTrees = () => {
    const treeList = getTreeList();
    setTrees(treeList);
    
    const currentId = getCurrentTreeId();
    if (currentId) {
      const tree = getTree(currentId);
      if (tree) {
        setCurrentTree(tree);
        loadMainPerson(currentId, tree);
      } else if (treeList.length > 0) {
        selectTree(treeList[0].treeId);
      }
    } else if (treeList.length > 0) {
      selectTree(treeList[0].treeId);
    }
  };

  const loadMainPerson = (treeId: string, tree: FamilyTree) => {
    const savedMainId = localStorage.getItem(MAIN_PERSON_KEY + treeId);
    let initialPersonId: string | null = null;
    
    // Use default person if set, otherwise use saved main or first person
    if (tree.defaultPersonId && tree.treeData.find(p => p.personId === tree.defaultPersonId)) {
      initialPersonId = tree.defaultPersonId;
    } else if (savedMainId && tree.treeData.find(p => p.personId === savedMainId)) {
      initialPersonId = savedMainId;
    } else if (tree.treeData.length > 0) {
      initialPersonId = tree.treeData[0].personId;
    }
    
    setMainPersonId(initialPersonId);
    // Reset history when loading a new tree
    if (initialPersonId) {
      setHistory([initialPersonId]);
      setHistoryIndex(0);
    } else {
      setHistory([]);
      setHistoryIndex(-1);
    }
  };

  const selectTree = (treeId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const tree = getTree(treeId);
      if (tree) {
        setCurrentTree(tree);
        setCurrentTreeId(treeId);
        setSelectedPersonId(null);
        loadMainPerson(treeId, tree);
      }
      setIsLoading(false);
    }, 300);
  };

  const handleSetMainPerson = useCallback((personId: string, fromHistory = false) => {
    if (personId === mainPersonId && !showFullTree) return;
    
    // Exit full tree mode when selecting a person
    if (showFullTree) {
      setShowFullTree(false);
    }
    
    setIsLoading(true);
    setTimeout(() => {
      setMainPersonId(personId);
      setSelectedPersonId(personId); // Update selected person for floating toolbar
      if (currentTree) {
        localStorage.setItem(MAIN_PERSON_KEY + currentTree.treeId, personId);
      }
      
      // Add to history only if not navigating from history
      if (!fromHistory) {
        setHistory(prev => {
          // Remove any forward history and add new entry
          const newHistory = [...prev.slice(0, historyIndex + 1), personId];
          return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
      }
      
      setIsLoading(false);
    }, 300);
  }, [currentTree, mainPersonId, historyIndex, showFullTree]);

  const handleNavigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevPersonId = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      handleSetMainPerson(prevPersonId, true);
    }
  }, [history, historyIndex, handleSetMainPerson]);

  const handleNavigateForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextPersonId = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      handleSetMainPerson(nextPersonId, true);
    }
  }, [history, historyIndex, handleSetMainPerson]);

  const handleNewTree = () => {
    setNewTreeModalOpen(true);
  };

  const handleCreateTree = (treeName: string) => {
    const newTree = createEmptyTree(treeName);
    saveTree(newTree);
    setTrees(getTreeList());
    selectTree(newTree.treeId);
  };

  const handleImportTree = (importedTree: FamilyTree) => {
    const newTree: FamilyTree = {
      ...importedTree,
      treeId: generateTreeId(),
      treeName: importedTree.treeName + ' (Imported)',
      modifyDate: new Date().toISOString()
    };
    saveTree(newTree);
    setTrees(getTreeList());
    selectTree(newTree.treeId);
  };

  const handleDownloadTree = () => {
    if (currentTree) {
      downloadTree(currentTree);
    }
  };

  const handleUpdateTree = (treeId: string, newName: string, isPublic: boolean) => {
    const tree = getTree(treeId);
    if (tree) {
      tree.treeName = newName;
      tree.isPublic = isPublic;
      tree.modifyDate = new Date().toISOString();
      saveTree(tree);
      setTrees(getTreeList());
      if (currentTree?.treeId === treeId) {
        setCurrentTree({ ...currentTree, treeName: newName, isPublic });
      }
    }
  };

  const handleDeleteTree = (treeId: string) => {
    deleteTree(treeId);
    localStorage.removeItem(MAIN_PERSON_KEY + treeId);
    const newList = getTreeList();
    setTrees(newList);
    
    if (currentTree?.treeId === treeId) {
      if (newList.length > 0) {
        selectTree(newList[0].treeId);
      } else {
        setCurrentTree(null);
        setCurrentTreeId(null);
        setMainPersonId(null);
      }
    }
  };

  const handleAddPerson = useCallback((parentId?: string, relation?: 'child' | 'parent' | 'spouse') => {
    setEditingPerson(null);
    if (parentId && relation) {
      setRelationContext({ parentId, relation });
    } else {
      setRelationContext(undefined);
    }
    setSliderOpen(true);
  }, []);

  const handleEditPerson = useCallback((person: Person) => {
    setEditingPerson(person);
    setRelationContext(undefined);
    setSliderOpen(true);
  }, []);

  const handleSavePerson = (person: Person, context?: { parentId: string; relation: 'child' | 'parent' | 'spouse' }) => {
    if (!currentTree) return;

    const updatedTree = { ...currentTree };
    const existingIndex = updatedTree.treeData.findIndex(p => p.personId === person.personId);

    if (existingIndex >= 0) {
      const oldPerson = updatedTree.treeData[existingIndex];
      
      // Handle spouse relationship changes
      const oldSpouseId = oldPerson.spouses[0]?.spouseId;
      const newSpouseId = person.spouses[0]?.spouseId;
      
      // Remove this person from old spouse's spouse list
      if (oldSpouseId && oldSpouseId !== newSpouseId) {
        updatedTree.treeData = updatedTree.treeData.map(p => 
          p.personId === oldSpouseId 
            ? { ...p, spouses: p.spouses.filter(s => s.spouseId !== person.personId) }
            : p
        );
      }
      
      // Add this person to new spouse's spouse list (if not already there)
      if (newSpouseId && newSpouseId !== oldSpouseId) {
        updatedTree.treeData = updatedTree.treeData.map(p => {
          if (p.personId === newSpouseId) {
            const alreadySpouse = p.spouses.some(s => s.spouseId === person.personId);
            if (!alreadySpouse) {
              return { ...p, spouses: [...p.spouses, { spouseId: person.personId, marriageDate: '', divorceDate: '' }] };
            }
          }
          return p;
        });
      }
      
      updatedTree.treeData[existingIndex] = person;
    } else {
      if (context) {
        const parent = updatedTree.treeData.find(p => p.personId === context.parentId);
        
        if (context.relation === 'child') {
          if (parent?.gender === 'male') {
            person.fatherId = context.parentId;
            const spouse = parent.spouses[0];
            if (spouse) person.motherId = spouse.spouseId;
          } else {
            person.motherId = context.parentId;
            const spouse = parent?.spouses[0];
            if (spouse) person.fatherId = spouse.spouseId;
          }
        } else if (context.relation === 'parent') {
          if (person.gender === 'male') {
            updatedTree.treeData = updatedTree.treeData.map(p => 
              p.personId === context.parentId ? { ...p, fatherId: person.personId } : p
            );
          } else {
            updatedTree.treeData = updatedTree.treeData.map(p => 
              p.personId === context.parentId ? { ...p, motherId: person.personId } : p
            );
          }
        } else if (context.relation === 'spouse' && parent) {
          person.spouses = [{ spouseId: context.parentId, marriageDate: '', divorceDate: '' }];
          updatedTree.treeData = updatedTree.treeData.map(p => 
            p.personId === context.parentId 
              ? { ...p, spouses: [...p.spouses, { spouseId: person.personId, marriageDate: '', divorceDate: '' }] }
              : p
          );
        }
      }
      updatedTree.treeData.push(person);

      // If this is the first person, set as main
      if (updatedTree.treeData.length === 1) {
        setMainPersonId(person.personId);
        localStorage.setItem(MAIN_PERSON_KEY + updatedTree.treeId, person.personId);
      }
    }

    saveTree(updatedTree);
    setCurrentTree(updatedTree);
  };

  const handleDeletePerson = (personId: string) => {
    if (!currentTree) return;

    const updatedTree = { ...currentTree };
    updatedTree.treeData = updatedTree.treeData
      .filter(p => p.personId !== personId)
      .map(p => ({
        ...p,
        fatherId: p.fatherId === personId ? undefined : p.fatherId,
        motherId: p.motherId === personId ? undefined : p.motherId,
        spouses: p.spouses.filter(s => s.spouseId !== personId)
      }));

    // Clear default if deleted person was default
    if (updatedTree.defaultPersonId === personId) {
      updatedTree.defaultPersonId = undefined;
    }

    saveTree(updatedTree);
    setCurrentTree(updatedTree);
    setSelectedPersonId(null);

    // If deleted person was main, select new main
    if (mainPersonId === personId) {
      if (updatedTree.treeData.length > 0) {
        setMainPersonId(updatedTree.treeData[0].personId);
        localStorage.setItem(MAIN_PERSON_KEY + updatedTree.treeId, updatedTree.treeData[0].personId);
      } else {
        setMainPersonId(null);
      }
    }
  };

  const handleSetDefaultPerson = useCallback((personId: string) => {
    if (!currentTree) return;
    const updatedTree = { ...currentTree, defaultPersonId: personId };
    saveTree(updatedTree);
    setCurrentTree(updatedTree);
  }, [currentTree]);

  return (
    <div className="app-container">
      <Sidebar
        trees={trees}
        currentTreeId={currentTree?.treeId || null}
        currentTree={currentTree}
        mainPersonId={mainPersonId}
        onSelectTree={selectTree}
        onNewTree={handleNewTree}
        onImportTree={handleImportTree}
        onDownloadTree={handleDownloadTree}
        onDeleteTree={handleDeleteTree}
        onUpdateTree={handleUpdateTree}
        onSetMainPerson={handleSetMainPerson}
      />

      <Canvas
        tree={currentTree}
        mainPersonId={mainPersonId}
        defaultPersonId={currentTree?.defaultPersonId || null}
        isLoading={isLoading}
        onSetMainPerson={handleSetMainPerson}
        onSetDefaultPerson={handleSetDefaultPerson}
        onAddPerson={handleAddPerson}
        onEditPerson={handleEditPerson}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
        history={history}
        historyIndex={historyIndex}
        onNavigateBack={handleNavigateBack}
        onNavigateForward={handleNavigateForward}
        showSiblings={showSiblings}
        onToggleSiblings={() => setShowSiblings(prev => !prev)}
        showCousins={showCousins}
        onToggleCousins={() => setShowCousins(prev => !prev)}
        showFullTree={showFullTree}
        onToggleFullTree={() => setShowFullTree(prev => !prev)}
      />

      <PersonSlider
        isOpen={sliderOpen}
        onClose={() => setSliderOpen(false)}
        person={editingPerson}
        tree={currentTree}
        relationContext={relationContext}
        onSave={handleSavePerson}
        onDelete={handleDeletePerson}
      />

      <NewTreeModal
        isOpen={newTreeModalOpen}
        onClose={() => setNewTreeModalOpen(false)}
        onSubmit={handleCreateTree}
      />
    </div>
  );
}

export default App;
