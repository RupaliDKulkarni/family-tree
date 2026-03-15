import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTree } from './TreeContext';
import { getMainPersonId, setMainPersonId as setMainPersonIdStorage } from '../utils/storage';

interface NavigationContextValue {
  mainPersonId: string | null;
  selectedPersonId: string | null;
  isLoading: boolean;
  history: string[];
  historyIndex: number;
  setMainPerson: (personId: string, fromHistory?: boolean) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  selectPerson: (personId: string | null) => void;
  resetNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { currentTree } = useTree();
  const [mainPersonId, setMainPersonIdState] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load main person when tree changes
  useEffect(() => {
    if (!currentTree) {
      setMainPersonIdState(null);
      setSelectedPersonId(null);
      setHistory([]);
      setHistoryIndex(-1);
      return;
    }

    (async () => {
      const savedMainId = await getMainPersonId(currentTree.treeId);
      let initialPersonId: string | null = null;

      if (currentTree.defaultPersonId && currentTree.treeData.find(p => p.personId === currentTree.defaultPersonId)) {
        initialPersonId = currentTree.defaultPersonId;
      } else if (savedMainId && currentTree.treeData.find(p => p.personId === savedMainId)) {
        initialPersonId = savedMainId;
      } else if (currentTree.treeData.length > 0) {
        initialPersonId = currentTree.treeData[0].personId;
      }

      setMainPersonIdState(initialPersonId);
      setSelectedPersonId(null);
      if (initialPersonId) {
        setHistory([initialPersonId]);
        setHistoryIndex(0);
      } else {
        setHistory([]);
        setHistoryIndex(-1);
      }
    })();
  }, [currentTree?.treeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMainPerson = useCallback((personId: string, fromHistory = false) => {
    setIsLoading(true);
    setTimeout(() => {
      setMainPersonIdState(personId);
      setSelectedPersonId(personId);
      if (currentTree) {
        setMainPersonIdStorage(currentTree.treeId, personId);
      }

      if (!fromHistory) {
        setHistory(prev => [...prev.slice(0, historyIndex + 1), personId]);
        setHistoryIndex(prev => prev + 1);
      }

      setIsLoading(false);
    }, 300);
  }, [currentTree, historyIndex]);

  const navigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevPersonId = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setMainPerson(prevPersonId, true);
    }
  }, [history, historyIndex, setMainPerson]);

  const navigateForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextPersonId = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setMainPerson(nextPersonId, true);
    }
  }, [history, historyIndex, setMainPerson]);

  const selectPerson = useCallback((personId: string | null) => {
    setSelectedPersonId(personId);
  }, []);

  const resetNavigation = useCallback(() => {
    setMainPersonIdState(null);
    setSelectedPersonId(null);
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  return (
    <NavigationContext.Provider value={{
      mainPersonId,
      selectedPersonId,
      isLoading,
      history,
      historyIndex,
      setMainPerson,
      navigateBack,
      navigateForward,
      selectPerson,
      resetNavigation,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
