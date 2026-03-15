import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Person } from '../types';

interface UIContextValue {
  sliderOpen: boolean;
  editingPerson: Person | null;
  relationContext: { parentId: string; relation: 'child' | 'parent' | 'spouse' } | undefined;
  newTreeModalOpen: boolean;
  showSiblings: boolean;
  showCousins: boolean;
  showFullTree: boolean;
  closeMobilePanelRef: React.MutableRefObject<(() => void) | null>;
  openSlider: (person?: Person | null, parentId?: string, relation?: 'child' | 'parent' | 'spouse') => void;
  closeSlider: () => void;
  openNewTreeModal: () => void;
  closeNewTreeModal: () => void;
  toggleSiblings: () => void;
  toggleCousins: () => void;
  toggleFullTree: () => void;
  setShowFullTree: (value: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sliderOpen, setSliderOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [relationContext, setRelationContext] = useState<{ parentId: string; relation: 'child' | 'parent' | 'spouse' } | undefined>();
  const [newTreeModalOpen, setNewTreeModalOpen] = useState(false);
  const [showSiblings, setShowSiblings] = useState(false);
  const [showCousins, setShowCousins] = useState(false);
  const [showFullTree, setShowFullTreeState] = useState(false);
  const closeMobilePanelRef = useRef<(() => void) | null>(null);

  const openSlider = useCallback((person?: Person | null, parentId?: string, relation?: 'child' | 'parent' | 'spouse') => {
    setEditingPerson(person || null);
    if (parentId && relation) {
      setRelationContext({ parentId, relation });
    } else {
      setRelationContext(undefined);
    }
    setSliderOpen(true);
  }, []);

  const closeSlider = useCallback(() => {
    setSliderOpen(false);
  }, []);

  const openNewTreeModal = useCallback(() => {
    setNewTreeModalOpen(true);
  }, []);

  const closeNewTreeModal = useCallback(() => {
    setNewTreeModalOpen(false);
  }, []);

  const toggleSiblings = useCallback(() => {
    setShowSiblings(prev => !prev);
  }, []);

  const toggleCousins = useCallback(() => {
    setShowCousins(prev => {
      if (!prev) setShowSiblings(true);
      return !prev;
    });
  }, []);

  const toggleFullTree = useCallback(() => {
    setShowFullTreeState(prev => !prev);
  }, []);

  const setShowFullTree = useCallback((value: boolean) => {
    setShowFullTreeState(value);
  }, []);

  return (
    <UIContext.Provider value={{
      sliderOpen,
      editingPerson,
      relationContext,
      newTreeModalOpen,
      showSiblings,
      showCousins,
      showFullTree,
      closeMobilePanelRef,
      openSlider,
      closeSlider,
      openNewTreeModal,
      closeNewTreeModal,
      toggleSiblings,
      toggleCousins,
      toggleFullTree,
      setShowFullTree,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
