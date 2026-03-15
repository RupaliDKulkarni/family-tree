import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Person } from '../../types';
import { useTree } from '../../hooks/useTree';
import { useNavigation } from '../../hooks/useNavigation';
import { useUI } from '../../hooks/useUI';
import LoginButton from '../LoginButton/LoginButton';
import PersonNode from '../PersonNode/PersonNode';
import './Canvas.css';

interface NodeLayout {
  person: Person;
  x: number;
  y: number;
  generation: number;
  isBloodRelative: boolean;
  isSibling: boolean;
  isCousin: boolean;
  siblingOfPersonId?: string;
  siblingOfGender?: 'male' | 'female';
  cousinOfPersonId?: string;
  spouses?: Person[];
  bloodParentId?: string;
  bloodChildId?: string;
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 80;
const SPOUSE_GAP = 0;
const SIBLING_GAP = 20;
const H_GAP = 50;
const V_GAP = 70;

const Canvas: React.FC = () => {
  const { currentTree, setDefaultPerson } = useTree();
  const {
    mainPersonId, selectedPersonId, selectPerson, setMainPerson,
    isLoading, history, historyIndex, navigateBack, navigateForward
  } = useNavigation();
  const {
    showSiblings, showCousins, showFullTree,
    toggleSiblings, toggleCousins, toggleFullTree,
    setShowFullTree, openSlider, closeMobilePanelRef
  } = useUI();

  const tree = currentTree;
  const defaultPersonId = currentTree?.defaultPersonId || null;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [tappedPersonId, setTappedPersonId] = useState<string | null>(null);
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const activeTouchCount = useRef(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    tree?.treeData.forEach(p => map.set(p.personId, p));
    return map;
  }, [tree]);

  const getChildren = useCallback((personId: string): Person[] => {
    if (!tree) return [];
    return tree.treeData.filter(p => p.fatherId === personId || p.motherId === personId);
  }, [tree]);

  const getSiblings = useCallback((person: Person): Person[] => {
    if (!tree) return [];
    return tree.treeData.filter(p => 
      p.personId !== person.personId &&
      ((p.fatherId && p.fatherId === person.fatherId) || (p.motherId && p.motherId === person.motherId))
    );
  }, [tree]);

  const bloodRelatives = useMemo(() => {
    const relatives = new Set<string>();
    if (!mainPersonId || !tree) return relatives;

    const mainPerson = personMap.get(mainPersonId);
    if (!mainPerson) return relatives;

    relatives.add(mainPersonId);

    const addAncestors = (person: Person) => {
      if (person.fatherId) {
        relatives.add(person.fatherId);
        const father = personMap.get(person.fatherId);
        if (father) addAncestors(father);
      }
      if (person.motherId) {
        relatives.add(person.motherId);
        const mother = personMap.get(person.motherId);
        if (mother) addAncestors(mother);
      }
    };
    addAncestors(mainPerson);

    const addDescendants = (personId: string) => {
      const children = getChildren(personId);
      children.forEach(child => {
        relatives.add(child.personId);
        addDescendants(child.personId);
      });
    };
    addDescendants(mainPersonId);

    const mainSiblings = getSiblings(mainPerson);
    mainSiblings.forEach(sib => relatives.add(sib.personId));

    return relatives;
  }, [mainPersonId, tree, personMap, getChildren, getSiblings]);

  const calculateLayout = useCallback((): NodeLayout[] => {
    if (!tree || tree.treeData.length === 0 || !mainPersonId) return [];

    const mainPerson = personMap.get(mainPersonId);
    if (!mainPerson) return [];

    const layouts: NodeLayout[] = [];
    const processed = new Set<string>();
    const generationNodes: Map<number, NodeLayout[]> = new Map();

    const addToGeneration = (layout: NodeLayout) => {
      if (!generationNodes.has(layout.generation)) {
        generationNodes.set(layout.generation, []);
      }
      generationNodes.get(layout.generation)!.push(layout);
      layouts.push(layout);
    };

    const getCurrentSpouse = (person: Person): Person | undefined => {
      if (person.spouses.length === 0) return undefined;
      const currentSpouseEntry = person.spouses.find(s => !s.divorceDate) || person.spouses[person.spouses.length - 1];
      return personMap.get(currentSpouseEntry.spouseId);
    };

    const getAllSpouses = (person: Person): Person[] => {
      return person.spouses
        .map(s => personMap.get(s.spouseId))
        .filter((s): s is Person => !!s);
    };

    const getDisplayInfo = (person: Person, isMainContext: boolean): { main: Person; spouses: Person[] } => {
      const spouses = isMainContext ? getAllSpouses(person) : 
        (getCurrentSpouse(person) ? [getCurrentSpouse(person)!] : []);
      
      if (person.gender === 'male') {
        return { main: person, spouses };
      } else if (spouses.length > 0 && spouses[0].gender === 'male') {
        return { main: spouses[0], spouses: [person, ...spouses.slice(1)] };
      }
      return { main: person, spouses };
    };

    const processAncestors = (person: Person, generation: number) => {
      const father = person.fatherId ? personMap.get(person.fatherId) : undefined;
      const mother = person.motherId ? personMap.get(person.motherId) : undefined;

      if (father && !processed.has(father.personId)) {
        processed.add(father.personId);
        addToGeneration({
          person: father, x: 0, y: 0, generation: generation - 1,
          isBloodRelative: true, isSibling: false, isCousin: false
        });

        if (showSiblings) {
          const fatherSiblings = getSiblings(father);
          fatherSiblings.forEach(sib => {
            if (!processed.has(sib.personId)) {
              processed.add(sib.personId);
              addToGeneration({
                person: sib, x: 0, y: 0, generation: generation - 1,
                isBloodRelative: false, isSibling: true, isCousin: false,
                siblingOfPersonId: father.personId, siblingOfGender: 'male'
              });
              
              if (showCousins && generation === 0) {
                const cousins = getChildren(sib.personId);
                cousins.forEach(cousin => {
                  if (!processed.has(cousin.personId)) {
                    processed.add(cousin.personId);
                    addToGeneration({
                      person: cousin, x: 0, y: 0, generation: 0,
                      isBloodRelative: false, isSibling: false, isCousin: true,
                      cousinOfPersonId: sib.personId
                    });
                  }
                });
              }
            }
          });
        }

        processAncestors(father, generation - 1);
      }

      if (mother && !processed.has(mother.personId)) {
        processed.add(mother.personId);
        addToGeneration({
          person: mother, x: 0, y: 0, generation: generation - 1,
          isBloodRelative: true, isSibling: false, isCousin: false
        });

        if (showSiblings) {
          const motherSiblings = getSiblings(mother);
          motherSiblings.forEach(sib => {
            if (!processed.has(sib.personId)) {
              processed.add(sib.personId);
              addToGeneration({
                person: sib, x: 0, y: 0, generation: generation - 1,
                isBloodRelative: false, isSibling: true, isCousin: false,
                siblingOfPersonId: mother.personId, siblingOfGender: 'female'
              });
              
              if (showCousins && generation === 0) {
                const cousins = getChildren(sib.personId);
                cousins.forEach(cousin => {
                  if (!processed.has(cousin.personId)) {
                    processed.add(cousin.personId);
                    addToGeneration({
                      person: cousin, x: 0, y: 0, generation: 0,
                      isBloodRelative: false, isSibling: false, isCousin: true,
                      cousinOfPersonId: sib.personId
                    });
                  }
                });
              }
            }
          });
        }

        processAncestors(mother, generation - 1);
      }
    };

    const processDescendants = (bloodParentId: string, generation: number) => {
      const children = getChildren(bloodParentId);
      
      children.forEach(child => {
        if (processed.has(child.personId)) return;
        processed.add(child.personId);

        const { main, spouses } = getDisplayInfo(child, false);
        const isChildBlood = bloodRelatives.has(child.personId);
        
        const bloodParent = bloodRelatives.has(child.fatherId || '') ? child.fatherId : 
                           bloodRelatives.has(child.motherId || '') ? child.motherId : 
                           bloodParentId;

        addToGeneration({
          person: main, x: 0, y: 0, generation: generation + 1,
          isBloodRelative: isChildBlood, isSibling: false, isCousin: false,
          spouses, bloodParentId: bloodParent, bloodChildId: child.personId
        });

        spouses.forEach(spouse => {
          if (!processed.has(spouse.personId)) {
            processed.add(spouse.personId);
          }
        });

        if (isChildBlood) {
          processDescendants(child.personId, generation + 1);
        }
      });
    };

    processed.add(mainPerson.personId);
    const { main: displayMain, spouses: displaySpouses } = getDisplayInfo(mainPerson, true);
    
    const mainBloodParent = mainPerson.fatherId || mainPerson.motherId;

    addToGeneration({
      person: displayMain, x: 0, y: 0, generation: 0,
      isBloodRelative: true, isSibling: false, isCousin: false,
      spouses: displaySpouses, bloodParentId: mainBloodParent
    });

    displaySpouses.forEach(spouse => {
      if (!processed.has(spouse.personId)) {
        processed.add(spouse.personId);
      }
    });

    if (showSiblings) {
      const mainSiblings = getSiblings(mainPerson);
      mainSiblings.forEach(sib => {
        if (!processed.has(sib.personId)) {
          processed.add(sib.personId);
          addToGeneration({
            person: sib, x: 0, y: 0, generation: 0,
            isBloodRelative: true, isSibling: true, isCousin: false,
            siblingOfPersonId: mainPerson.personId,
            siblingOfGender: mainPerson.gender === 'male' ? 'male' : 'female',
            bloodParentId: sib.fatherId || sib.motherId
          });
        }
      });
    }

    processAncestors(mainPerson, 0);
    processDescendants(mainPersonId, 0);

    // Calculate positions by generation
    const sortedGenerations = Array.from(generationNodes.keys()).sort((a, b) => a - b);
    const minGen = sortedGenerations[0] || 0;

    sortedGenerations.forEach(gen => {
      const nodes = generationNodes.get(gen)!;
      
      const mainNodes = nodes.filter(n => !n.isSibling && !n.isCousin);
      const siblingNodes = nodes.filter(n => n.isSibling);
      const cousinNodes = nodes.filter(n => n.isCousin);

      mainNodes.sort((a, b) => {
        if (gen === 0) {
          const aIsMain = a.person.personId === mainPersonId || a.spouses?.some(s => s.personId === mainPersonId);
          const bIsMain = b.person.personId === mainPersonId || b.spouses?.some(s => s.personId === mainPersonId);
          if (aIsMain) return -1;
          if (bIsMain) return 1;
        }
        return 0;
      });
      
      const getNodeWidth = (node: NodeLayout): number => {
        const spouseCount = node.spouses?.length || 0;
        if (spouseCount === 0) return NODE_WIDTH;
        return NODE_WIDTH + (spouseCount * (NODE_WIDTH + SPOUSE_GAP));
      };

      const siblingsByOwner = new Map<string, NodeLayout[]>();
      siblingNodes.forEach(sib => {
        const ownerId = sib.siblingOfPersonId || '';
        if (!siblingsByOwner.has(ownerId)) {
          siblingsByOwner.set(ownerId, []);
        }
        siblingsByOwner.get(ownerId)!.push(sib);
      });

      interface Segment {
        leftSiblings: NodeLayout[];
        mainNode: NodeLayout;
        rightSiblings: NodeLayout[];
      }
      const segments: Segment[] = [];

      mainNodes.forEach(node => {
        const personId = node.person.personId;
        const lastSpouseId = node.spouses?.[node.spouses.length - 1]?.personId;
        
        const leftSibs = siblingsByOwner.get(personId) || [];
        const rightSibs = lastSpouseId ? (siblingsByOwner.get(lastSpouseId) || []) : [];
        
        segments.push({
          leftSiblings: leftSibs.filter(s => s.siblingOfGender === 'male'),
          mainNode: node,
          rightSiblings: rightSibs.filter(s => s.siblingOfGender === 'female')
        });
        
        if (!node.spouses?.length && node.person.gender === 'female') {
          const femaleSibs = siblingsByOwner.get(personId) || [];
          segments[segments.length - 1].rightSiblings = femaleSibs;
          segments[segments.length - 1].leftSiblings = [];
        }
      });

      const cousinWidth = cousinNodes.length * NODE_WIDTH + Math.max(0, cousinNodes.length - 1) * SIBLING_GAP;

      let totalWidth = 0;
      segments.forEach((seg, idx) => {
        const leftW = seg.leftSiblings.length * NODE_WIDTH + Math.max(0, seg.leftSiblings.length - 1) * SIBLING_GAP;
        const mainW = getNodeWidth(seg.mainNode);
        const rightW = seg.rightSiblings.length * NODE_WIDTH + Math.max(0, seg.rightSiblings.length - 1) * SIBLING_GAP;
        
        totalWidth += (seg.leftSiblings.length > 0 ? leftW + SIBLING_GAP : 0) + mainW + 
                      (seg.rightSiblings.length > 0 ? SIBLING_GAP + rightW : 0);
        if (idx < segments.length - 1) totalWidth += H_GAP;
      });
      
      if (cousinNodes.length > 0) {
        totalWidth += H_GAP + cousinWidth;
      }

      let currentX = -totalWidth / 2;
      const y = (gen - minGen) * (NODE_HEIGHT + V_GAP);

      segments.forEach((seg, idx) => {
        seg.leftSiblings.forEach(sib => {
          sib.x = currentX;
          sib.y = y;
          currentX += NODE_WIDTH + SIBLING_GAP;
        });

        seg.mainNode.x = currentX;
        seg.mainNode.y = y;
        currentX += getNodeWidth(seg.mainNode);

        if (seg.rightSiblings.length > 0) {
          currentX += SIBLING_GAP;
          seg.rightSiblings.forEach(sib => {
            sib.x = currentX;
            sib.y = y;
            currentX += NODE_WIDTH + SIBLING_GAP;
          });
          currentX -= SIBLING_GAP;
        }

        if (idx < segments.length - 1) currentX += H_GAP;
      });

      if (cousinNodes.length > 0) {
        currentX += H_GAP;
        cousinNodes.forEach(cousin => {
          cousin.x = currentX;
          cousin.y = y;
          currentX += NODE_WIDTH + SIBLING_GAP;
        });
      }
    });

    return layouts;
  }, [tree, mainPersonId, personMap, getChildren, getSiblings, bloodRelatives, showSiblings, showCousins]);

  const calculateFullTreeLayout = useCallback((): NodeLayout[] => {
    if (!tree || tree.treeData.length === 0) return [];

    const layouts: NodeLayout[] = [];
    const processed = new Set<string>();
    const generationMap = new Map<string, number>();

    tree.treeData.forEach(p => generationMap.set(p.personId, 0));

    const getGen = (id: string) => generationMap.get(id) || 0;
    const setGen = (id: string, gen: number) => generationMap.set(id, gen);

    const getSiblingsLocal = (person: Person): Person[] => {
      return tree.treeData.filter(other => 
        other.personId !== person.personId &&
        ((person.fatherId && person.fatherId === other.fatherId) ||
         (person.motherId && person.motherId === other.motherId))
      );
    };

    let changed = true;
    let iterations = 0;
    const maxIterations = 200;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      tree.treeData.forEach(person => {
        let requiredGen = getGen(person.personId);
        if (person.fatherId) requiredGen = Math.max(requiredGen, getGen(person.fatherId) + 1);
        if (person.motherId) requiredGen = Math.max(requiredGen, getGen(person.motherId) + 1);
        if (requiredGen > getGen(person.personId)) { setGen(person.personId, requiredGen); changed = true; }
      });

      tree.treeData.forEach(person => {
        const personGen = getGen(person.personId);
        person.spouses.forEach(spouseEntry => {
          const spouseGen = getGen(spouseEntry.spouseId);
          const maxGen = Math.max(personGen, spouseGen);
          if (getGen(person.personId) < maxGen) { setGen(person.personId, maxGen); changed = true; }
          if (getGen(spouseEntry.spouseId) < maxGen) { setGen(spouseEntry.spouseId, maxGen); changed = true; }
        });
      });

      tree.treeData.forEach(person => {
        const siblings = getSiblingsLocal(person);
        if (siblings.length > 0) {
          let maxGen = getGen(person.personId);
          siblings.forEach(sib => { maxGen = Math.max(maxGen, getGen(sib.personId)); });
          if (getGen(person.personId) < maxGen) { setGen(person.personId, maxGen); changed = true; }
          siblings.forEach(sib => {
            if (getGen(sib.personId) < maxGen) { setGen(sib.personId, maxGen); changed = true; }
          });
        }
      });

      tree.treeData.forEach(person => {
        const personGen = getGen(person.personId);
        const expectedParentGen = personGen - 1;
        if (person.fatherId && getGen(person.fatherId) < expectedParentGen) { setGen(person.fatherId, expectedParentGen); changed = true; }
        if (person.motherId && getGen(person.motherId) < expectedParentGen) { setGen(person.motherId, expectedParentGen); changed = true; }
      });
    }

    const allGens = Array.from(generationMap.values());
    const minGen = Math.min(...allGens);
    if (minGen !== 0) {
      tree.treeData.forEach(p => { setGen(p.personId, getGen(p.personId) - minGen); });
    }

    const getAllSpouses = (person: Person): Person[] => {
      return person.spouses.map(s => personMap.get(s.spouseId)).filter((s): s is Person => !!s);
    };

    const generationNodes = new Map<number, NodeLayout[]>();

    tree.treeData.forEach(person => {
      if (processed.has(person.personId)) return;

      const gen = getGen(person.personId);
      const spouses = getAllSpouses(person);

      let displayMain = person;
      let displaySpouses = spouses;

      if (person.gender === 'female' && spouses.length > 0 && spouses[0].gender === 'male') {
        displayMain = spouses[0];
        displaySpouses = [person, ...spouses.slice(1)];
      }

      if (processed.has(displayMain.personId)) return;

      processed.add(displayMain.personId);
      displaySpouses.forEach(s => processed.add(s.personId));

      const layout: NodeLayout = {
        person: displayMain, x: 0, y: 0, generation: gen,
        isBloodRelative: true, isSibling: false, isCousin: false,
        spouses: displaySpouses
      };

      if (!generationNodes.has(gen)) generationNodes.set(gen, []);
      generationNodes.get(gen)!.push(layout);
      layouts.push(layout);
    });

    const sortedGens = Array.from(generationNodes.keys()).sort((a, b) => a - b);

    const getNodeWidth = (node: NodeLayout): number => {
      const spouseCount = node.spouses?.length || 0;
      if (spouseCount === 0) return NODE_WIDTH;
      return NODE_WIDTH + (spouseCount * (NODE_WIDTH + SPOUSE_GAP));
    };

    sortedGens.forEach(gen => {
      const nodes = generationNodes.get(gen)!;
      let totalWidth = 0;
      nodes.forEach((node, idx) => {
        totalWidth += getNodeWidth(node);
        if (idx < nodes.length - 1) totalWidth += H_GAP;
      });

      let currentX = -totalWidth / 2;
      const y = gen * (NODE_HEIGHT + V_GAP);

      nodes.forEach((node, idx) => {
        node.x = currentX;
        node.y = y;
        currentX += getNodeWidth(node);
        if (idx < nodes.length - 1) currentX += H_GAP;
      });
    });

    return layouts;
  }, [tree, personMap]);

  const layouts = showFullTree ? calculateFullTreeLayout() : calculateLayout();
  
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    layouts.forEach(l => {
      map.set(l.person.personId, { x: l.x, y: l.y });
      if (l.spouses) {
        l.spouses.forEach((spouse, idx) => {
          map.set(spouse.personId, { x: l.x + (idx + 1) * (NODE_WIDTH + SPOUSE_GAP), y: l.y });
        });
      }
    });
    return map;
  }, [layouts]);

  const renderConnections = () => {
    if (!tree || layouts.length === 0) return null;
    if (!showFullTree && !mainPersonId) return null;
    
    const elements: JSX.Element[] = [];
    const drawnConnections = new Set<string>();

    const getNodePos = (personId: string) => positionMap.get(personId);

    const drawParentLines = (p: Person, pPos: { x: number; y: number }) => {
      const pCenterX = pPos.x + NODE_WIDTH / 2;
      const pTopY = pPos.y;

      if (p.fatherId) {
        const fatherPos = getNodePos(p.fatherId);
        if (fatherPos) {
          const key = `father-${p.fatherId}-${p.personId}`;
          if (!drawnConnections.has(key)) {
            drawnConnections.add(key);
            const parentCenterX = fatherPos.x + NODE_WIDTH / 2;
            const parentBottomY = fatherPos.y + NODE_HEIGHT;
            const midY = (pTopY + parentBottomY) / 2;
            elements.push(
              <path key={key} d={`M ${pCenterX} ${pTopY} C ${pCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none" stroke="#444" strokeWidth={2} />
            );
          }
        }
      }

      if (p.motherId) {
        const motherPos = getNodePos(p.motherId);
        if (motherPos) {
          const key = `mother-${p.motherId}-${p.personId}`;
          if (!drawnConnections.has(key)) {
            drawnConnections.add(key);
            const parentCenterX = motherPos.x + NODE_WIDTH / 2;
            const parentBottomY = motherPos.y + NODE_HEIGHT;
            const midY = (pTopY + parentBottomY) / 2;
            elements.push(
              <path key={key} d={`M ${pCenterX} ${pTopY} C ${pCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none" stroke="#444" strokeWidth={2} />
            );
          }
        }
      }
    };

    layouts.forEach(layout => {
      const person = layout.person;
      const personPos = getNodePos(person.personId);
      if (!personPos) return;

      if (showFullTree) return;

      if (layout.isSibling) return;

      if (layout.generation <= 0 && bloodRelatives.has(person.personId)) {
        drawParentLines(person, personPos);
      }

      if (layout.generation <= 0 && layout.spouses) {
        layout.spouses.forEach(spouse => {
          if (bloodRelatives.has(spouse.personId)) {
            const spousePos = getNodePos(spouse.personId);
            if (spousePos) drawParentLines(spouse, spousePos);
          }
        });
      } else if (layout.generation > 0 && layout.bloodParentId && layout.bloodChildId) {
        const parentPos = getNodePos(layout.bloodParentId);
        const bloodChildPos = getNodePos(layout.bloodChildId);
        
        if (parentPos && bloodChildPos) {
          const key = `desc-${layout.bloodParentId}-${layout.bloodChildId}`;
          if (!drawnConnections.has(key)) {
            drawnConnections.add(key);
            const childCenterX = bloodChildPos.x + NODE_WIDTH / 2;
            const childTopY = bloodChildPos.y;
            const parentCenterX = parentPos.x + NODE_WIDTH / 2;
            const parentBottomY = parentPos.y + NODE_HEIGHT;
            const midY = (childTopY + parentBottomY) / 2;
            elements.push(
              <path key={key} d={`M ${childCenterX} ${childTopY} C ${childCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none" stroke="#444" strokeWidth={2} />
            );
          }
        }
      }
    });

    if (showFullTree) return elements;

    const generationGroups = new Map<number, NodeLayout[]>();
    layouts.forEach(l => {
      if (!generationGroups.has(l.generation)) generationGroups.set(l.generation, []);
      generationGroups.get(l.generation)!.push(l);
    });

    generationGroups.forEach((_nodes, gen) => {
      const siblingNodes = _nodes.filter(n => n.isSibling);
      
      const siblingsByOwner = new Map<string, NodeLayout[]>();
      siblingNodes.forEach(sib => {
        const ownerId = sib.siblingOfPersonId || '';
        if (!siblingsByOwner.has(ownerId)) siblingsByOwner.set(ownerId, []);
        siblingsByOwner.get(ownerId)!.push(sib);
      });

      siblingsByOwner.forEach((siblings, ownerId) => {
        const ownerPos = positionMap.get(ownerId);
        if (!ownerPos || siblings.length === 0) return;

        const ownerCenterY = ownerPos.y + NODE_HEIGHT / 2;
        const sortedSibs = [...siblings].sort((a, b) => a.x - b.x);
        const isLeftSide = sortedSibs[0].siblingOfGender === 'male';

        if (isLeftSide) {
          const lastSib = sortedSibs[sortedSibs.length - 1];
          elements.push(
            <line key={`sib-owner-${ownerId}-${gen}`}
              x1={lastSib.x + NODE_WIDTH} y1={lastSib.y + NODE_HEIGHT / 2}
              x2={ownerPos.x} y2={ownerCenterY}
              stroke="#aaa" strokeWidth={1.5} strokeDasharray="4,4" />
          );
        } else {
          const firstSib = sortedSibs[0];
          elements.push(
            <line key={`sib-owner-${ownerId}-${gen}`}
              x1={ownerPos.x + NODE_WIDTH} y1={ownerCenterY}
              x2={firstSib.x} y2={firstSib.y + NODE_HEIGHT / 2}
              stroke="#aaa" strokeWidth={1.5} strokeDasharray="4,4" />
          );
        }

        for (let i = 0; i < sortedSibs.length - 1; i++) {
          elements.push(
            <line key={`sib-connect-${ownerId}-${gen}-${i}`}
              x1={sortedSibs[i].x + NODE_WIDTH} y1={sortedSibs[i].y + NODE_HEIGHT / 2}
              x2={sortedSibs[i + 1].x} y2={sortedSibs[i + 1].y + NODE_HEIGHT / 2}
              stroke="#aaa" strokeWidth={1.5} strokeDasharray="4,4" />
          );
        }
      });
    });

    return elements;
  };

  const renderHoverLineage = () => {
    const activeHoverId = isMobile ? tappedPersonId : hoveredPersonId;
    if (!showFullTree || !activeHoverId || !tree) return null;

    const elements: JSX.Element[] = [];
    const getNodePos = (personId: string) => positionMap.get(personId);
    const drawnConnections = new Set<string>();

    const areSpouses = (person1Id: string, person2Id: string): boolean => {
      const person1 = personMap.get(person1Id);
      if (!person1) return false;
      return person1.spouses.some(s => s.spouseId === person2Id);
    };

    interface Connection {
      childId: string;
      fatherId?: string;
      motherId?: string;
      isCouple: boolean;
      level: number;
      direction: 'up' | 'down';
    }
    const connections: Connection[] = [];

    const collectAncestors = (personId: string, level: number, visited: Set<string>) => {
      if (visited.has(personId)) return;
      visited.add(personId);
      const person = personMap.get(personId);
      if (!person) return;

      if (person.fatherId || person.motherId) {
        const isCouple = !!(person.fatherId && person.motherId && areSpouses(person.fatherId, person.motherId));
        const connKey = `${personId}-parents`;
        if (!drawnConnections.has(connKey)) {
          drawnConnections.add(connKey);
          connections.push({ childId: personId, fatherId: person.fatherId, motherId: person.motherId, isCouple, level, direction: 'up' });
        }
        if (person.fatherId) collectAncestors(person.fatherId, level + 1, visited);
        if (person.motherId) collectAncestors(person.motherId, level + 1, visited);
      }
    };

    const collectDescendants = (personId: string, level: number, visited: Set<string>) => {
      if (visited.has(personId)) return;
      visited.add(personId);
      const person = personMap.get(personId);
      if (!person) return;

      tree.treeData.forEach(child => {
        if (child.fatherId === personId || child.motherId === personId) {
          const connKey = `${child.personId}-to-${personId}`;
          if (!drawnConnections.has(connKey)) {
            drawnConnections.add(connKey);
            const otherParentId = child.fatherId === personId ? child.motherId : child.fatherId;
            const isCouple = otherParentId && areSpouses(personId, otherParentId);
            connections.push({ childId: child.personId, fatherId: child.fatherId, motherId: child.motherId, isCouple: !!isCouple, level, direction: 'down' });
          }
          collectDescendants(child.personId, level + 1, visited);
        }
      });
    };

    collectAncestors(activeHoverId, 0, new Set());
    collectDescendants(activeHoverId, 0, new Set());

    const upConnections = connections.filter(c => c.direction === 'up').sort((a, b) => a.level - b.level);
    const downConnections = connections.filter(c => c.direction === 'down').sort((a, b) => a.level - b.level);

    const drawConnection = (conn: Connection, delay: number, goingDown: boolean) => {
      const childPos = getNodePos(conn.childId);
      if (!childPos) return;

      const childCenterX = childPos.x + NODE_WIDTH / 2;
      const childTopY = childPos.y;

      let parentCenterX: number;
      let parentBottomY: number;

      if (conn.isCouple && conn.fatherId && conn.motherId) {
        const fatherPos = getNodePos(conn.fatherId);
        const motherPos = getNodePos(conn.motherId);
        if (!fatherPos || !motherPos) return;
        parentCenterX = (fatherPos.x + NODE_WIDTH / 2 + motherPos.x + NODE_WIDTH / 2) / 2;
        parentBottomY = fatherPos.y + NODE_HEIGHT;
      } else {
        const parentId = conn.fatherId || conn.motherId;
        if (!parentId) return;
        const parentPos = getNodePos(parentId);
        if (!parentPos) return;
        parentCenterX = parentPos.x + NODE_WIDTH / 2;
        parentBottomY = parentPos.y + NODE_HEIGHT;
      }

      const midY = (childTopY + parentBottomY) / 2;

      const pathD = goingDown
        ? `M ${parentCenterX} ${parentBottomY} C ${parentCenterX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${childTopY}`
        : `M ${childCenterX} ${childTopY} C ${childCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`;

      elements.push(
        <path key={`hover-${conn.childId}-${conn.fatherId || ''}-${conn.motherId || ''}-${goingDown ? 'down' : 'up'}`}
          d={pathD} fill="none" stroke="#e74c3c" strokeWidth={3}
          className="hover-lineage-line" style={{ animationDelay: `${delay}ms` }} />
      );
    };

    upConnections.forEach((conn, idx) => { drawConnection(conn, idx * 150, false); });
    downConnections.forEach((conn, idx) => { drawConnection(conn, idx * 150, true); });

    return elements;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      activeTouchCount.current++;
      if (activeTouchCount.current > 1) return;
    }
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, .canvas-ribbon, .floating-toolbar, .person-node');
    if (!isInteractive && canvasRef.current?.contains(target)) {
      closeMobilePanelRef?.current?.();
      setShowOverflowMenu(false);
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning && activeTouchCount.current < 2) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      activeTouchCount.current = Math.max(0, activeTouchCount.current - 1);
    }
    setIsPanning(false);
    try {
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Pointer capture may already be released
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(0.3, z * delta), 2));
  };

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsPanning(false);
      lastTouchDist.current = getTouchDist(e.touches[0], e.touches[1]);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = newDist / lastTouchDist.current;
      setZoom(z => Math.min(Math.max(0.3, z * scale), 2));
      lastTouchDist.current = newDist;

      if (lastTouchCenter.current) {
        const newCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        setPan(p => ({
          x: p.x + (newCenter.x - lastTouchCenter.current!.x),
          y: p.y + (newCenter.y - lastTouchCenter.current!.y)
        }));
        lastTouchCenter.current = newCenter;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastTouchDist.current = null;
      lastTouchCenter.current = null;
    }
  };

  useEffect(() => {
    if (mainPersonId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: 150 });
    }
  }, [mainPersonId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' || (activeEl as HTMLElement).isContentEditable
      );
      if (isInputFocused) return;

      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); navigateBack(); }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); navigateForward(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBack, navigateForward]);

  const handleNodeClick = useCallback((personId: string) => {
    if (isMobile && showFullTree) {
      setTappedPersonId(prev => prev === personId ? null : personId);
      return;
    }
    selectPerson(personId);
    if (showFullTree) {
      setShowFullTree(false);
    }
    setMainPerson(personId);
  }, [selectPerson, setMainPerson, isMobile, showFullTree, setShowFullTree]);

  const handleEditSelected = useCallback(() => {
    if (selectedPersonId) {
      const person = personMap.get(selectedPersonId);
      if (person) openSlider(person);
    }
  }, [selectedPersonId, personMap, openSlider]);

  const handleAddChildToSelected = useCallback(() => {
    if (selectedPersonId) openSlider(null, selectedPersonId, 'child');
  }, [selectedPersonId, openSlider]);

  const handleAddParentToSelected = useCallback(() => {
    if (selectedPersonId) openSlider(null, selectedPersonId, 'parent');
  }, [selectedPersonId, openSlider]);

  const handleAddSpouseToSelected = useCallback(() => {
    if (selectedPersonId) openSlider(null, selectedPersonId, 'spouse');
  }, [selectedPersonId, openSlider]);

  const selectedPerson = selectedPersonId ? personMap.get(selectedPersonId) : null;

  if (!tree) {
    return (
      <div className="canvas-empty">
        <div className="empty-message">
          <h3>Welcome to Family Tree</h3>
          <p>Create a new tree or import an existing one from the sidebar</p>
        </div>
      </div>
    );
  }

  if (tree.treeData.length === 0) {
    return (
      <div className="canvas-empty">
        <div className="empty-message">
          <h3>{tree.treeName}</h3>
          <p>This tree is empty. Start by adding the first person.</p>
          <button className="btn-start" onClick={() => openSlider()}>
            + Add First Person
          </button>
        </div>
      </div>
    );
  }

  if (!mainPersonId) {
    return (
      <div className="canvas-empty">
        <div className="empty-message">
          <h3>{tree.treeName}</h3>
          <p>Select a person to center the tree view</p>
          <div className="person-list">
            {tree.treeData.slice(0, 10).map(p => (
              <button key={p.personId} onClick={() => setMainPerson(p.personId)}>
                {p.firstName} {p.lastName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Loading tree...</span>
        </div>
      )}

      <div className="canvas-ribbon">
        <div className="ribbon-section">
          <span className="ribbon-label">Navigate</span>
          <div className="ribbon-buttons">
            <button className="ribbon-btn" onClick={navigateBack} disabled={historyIndex <= 0} title="Go back (←)">
              {isMobile ? '←' : '← Back'}
            </button>
            {!isMobile && (
              <button className="ribbon-btn" onClick={navigateForward} disabled={historyIndex >= history.length - 1} title="Go forward (→)">
                Forward →
              </button>
            )}
          </div>
        </div>

        <div className="ribbon-divider" />

        <div className="ribbon-section">
          <span className="ribbon-label">View</span>
          <div className="ribbon-buttons">
            <button className={`ribbon-btn toggle ${showFullTree ? 'active' : 'inactive'}`}
              onClick={toggleFullTree} title="Show Full Tree (all members)">
              {isMobile ? '🌳' : '🌳 Full Tree'}
            </button>
            <button className={`ribbon-btn toggle ${showSiblings ? 'active' : 'inactive'}`}
              onClick={toggleSiblings} disabled={showFullTree} title="Show/Hide Siblings">
              {isMobile ? '👥' : '👥 Siblings'}
            </button>
            {!isMobile && (
              <button className={`ribbon-btn toggle ${showCousins ? 'active' : 'inactive'}`}
                onClick={toggleCousins} disabled={showFullTree} title="Show/Hide Cousins">
                👨‍👩‍👧‍👦 Cousins
              </button>
            )}
          </div>
        </div>

        <div className="ribbon-divider" />

        {!isMobile && (
          <>
            <div className="ribbon-section">
              <span className="ribbon-label">Zoom</span>
              <div className="ribbon-buttons">
                <button className="ribbon-btn" onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))}>−</button>
                <span className="zoom-display">{Math.round(zoom * 100)}%</span>
                <button className="ribbon-btn" onClick={() => setZoom(z => Math.min(z * 1.2, 2))}>+</button>
                <button className="ribbon-btn" onClick={() => { setZoom(1); if(canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); setPan({ x: rect.width / 2, y: 150 }); } }}>Reset</button>
              </div>
            </div>
            <div className="ribbon-divider" />
          </>
        )}

        <div className="ribbon-section">
          <span className="ribbon-label">Actions</span>
          <div className="ribbon-buttons">
            <button className="ribbon-btn primary" onClick={() => openSlider()}>
              {isMobile ? '+' : '+ Add Person'}
            </button>
          </div>
        </div>

        {isMobile && (
          <>
            <div className="ribbon-spacer" />
            <button className="ribbon-btn ribbon-overflow-toggle" onClick={() => setShowOverflowMenu(prev => !prev)} title="More options">
              ⋯
            </button>
            {showOverflowMenu && (
              <div className="ribbon-overflow-menu">
                <button className={`ribbon-btn toggle ${showCousins ? 'active' : 'inactive'}`}
                  onClick={() => { toggleCousins(); setShowOverflowMenu(false); }} disabled={showFullTree}>
                  👨‍👩‍👧‍👦 Cousins
                </button>
                <button className="ribbon-btn" onClick={() => { setZoom(1); if(canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); setPan({ x: rect.width / 2, y: 150 }); } setShowOverflowMenu(false); }}>
                  Reset Zoom
                </button>
              </div>
            )}
          </>
        )}

        {!isMobile && <div className="ribbon-spacer" />}

        <div className="ribbon-login">
          <LoginButton variant="ribbon" />
        </div>
      </div>

      <div className="canvas-content"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg className="connections-svg"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          <g transform="translate(0, 0)">
            {renderConnections()}
            {renderHoverLineage()}
          </g>
        </svg>

        {layouts.map(layout => (
          <React.Fragment key={layout.person.personId}>
            <PersonNode
              person={layout.person} x={layout.x} y={layout.y}
              isSelected={!showFullTree && selectedPersonId === layout.person.personId}
              isMainPerson={!showFullTree && mainPersonId === layout.person.personId}
              isDefaultPerson={!showFullTree && defaultPersonId === layout.person.personId}
              isBloodRelative={showFullTree || bloodRelatives.has(layout.person.personId)}
              isSibling={!showFullTree && layout.isSibling}
              isCousin={!showFullTree && layout.isCousin}
              hasSpouseAdjacent={(layout.spouses?.length || 0) > 0}
              onSelect={() => handleNodeClick(layout.person.personId)}
              onHover={showFullTree && !isMobile ? setHoveredPersonId : undefined}
              isHovered={showFullTree && (isMobile ? tappedPersonId === layout.person.personId : hoveredPersonId === layout.person.personId)}
            />
            {layout.spouses?.map((spouse, idx) => (
              <PersonNode
                key={spouse.personId}
                person={spouse}
                x={layout.x + (idx + 1) * (NODE_WIDTH + SPOUSE_GAP)}
                y={layout.y}
                isSelected={!showFullTree && selectedPersonId === spouse.personId}
                isMainPerson={!showFullTree && mainPersonId === spouse.personId}
                isDefaultPerson={!showFullTree && defaultPersonId === spouse.personId}
                isBloodRelative={showFullTree || bloodRelatives.has(spouse.personId)}
                isSibling={false} isCousin={false}
                hasSpouseAdjacent={idx < (layout.spouses?.length || 1) - 1}
                isSpousePosition={true}
                onSelect={() => handleNodeClick(spouse.personId)}
                onHover={showFullTree && !isMobile ? setHoveredPersonId : undefined}
                isHovered={showFullTree && (isMobile ? tappedPersonId === spouse.personId : hoveredPersonId === spouse.personId)}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {!showFullTree && selectedPerson && (
        <div className="floating-toolbar">
          <div className="selected-person-info">
            <span className={`gender-icon ${selectedPerson.gender}`}>
              {selectedPerson.gender === 'male' ? '♂' : '♀'}
            </span>
            <span className="selected-name">
              {selectedPerson.firstName} {selectedPerson.lastName}
            </span>
            {selectedPerson.dod && <span className="deceased-badge">†</span>}
            {defaultPersonId === selectedPerson.personId && <span className="default-badge">★</span>}
          </div>
          <div className="toolbar-actions">
            <button className="toolbar-btn" onClick={handleEditSelected} title="Edit Person">✎ Edit</button>
            <button className="toolbar-btn" onClick={handleAddParentToSelected} title="Add Parent">↑ Parent</button>
            <button className="toolbar-btn" onClick={handleAddChildToSelected} title="Add Child">↓ Child</button>
            <button className="toolbar-btn" onClick={handleAddSpouseToSelected} title="Add Spouse">♥ Spouse</button>
            {defaultPersonId !== selectedPerson.personId && (
              <button className="toolbar-btn default" onClick={() => setDefaultPerson(selectedPerson.personId)} title="Set as Default">★ Default</button>
            )}
            <button className="toolbar-btn close" onClick={() => selectPerson(null)} title="Close">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
