import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Person, FamilyTree } from '../../types';
import PersonNode from '../PersonNode/PersonNode';
import './Canvas.css';

interface CanvasProps {
  tree: FamilyTree | null;
  mainPersonId: string | null;
  defaultPersonId: string | null;
  isLoading: boolean;
  onSetMainPerson: (personId: string) => void;
  onSetDefaultPerson: (personId: string) => void;
  onAddPerson: (parentId?: string, relation?: 'child' | 'parent' | 'spouse') => void;
  onEditPerson: (person: Person) => void;
  selectedPersonId: string | null;
  onSelectPerson: (personId: string | null) => void;
  history: string[];
  historyIndex: number;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  showSiblings: boolean;
  onToggleSiblings: () => void;
  showCousins: boolean;
  onToggleCousins: () => void;
  showFullTree: boolean;
  onToggleFullTree: () => void;
}

interface NodeLayout {
  person: Person;
  x: number;
  y: number;
  generation: number;
  isBloodRelative: boolean;
  isSibling: boolean;
  isCousin: boolean;
  siblingOfPersonId?: string; // ID of the person whose sibling this is
  siblingOfGender?: 'male' | 'female'; // Gender of that person (determines left/right placement)
  cousinOfPersonId?: string; // ID of the parent's sibling (uncle/aunt) whose child this is
  spouses?: Person[]; // Multiple spouses support
  bloodParentId?: string; // The blood-related parent for line drawing
  bloodChildId?: string; // The actual blood child in this couple (for line targeting)
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 80;
const SPOUSE_GAP = 0;
const SIBLING_GAP = 20;
const H_GAP = 50;
const V_GAP = 70;

const Canvas: React.FC<CanvasProps> = ({
  tree,
  mainPersonId,
  defaultPersonId,
  isLoading,
  onSetMainPerson,
  onSetDefaultPerson,
  onAddPerson,
  onEditPerson,
  selectedPersonId,
  onSelectPerson,
  history,
  historyIndex,
  onNavigateBack,
  onNavigateForward,
  showSiblings,
  onToggleSiblings,
  showCousins,
  onToggleCousins,
  showFullTree,
  onToggleFullTree
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);

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

  // Calculate blood relatives of main person
  const bloodRelatives = useMemo(() => {
    const relatives = new Set<string>();
    if (!mainPersonId || !tree) return relatives;

    const mainPerson = personMap.get(mainPersonId);
    if (!mainPerson) return relatives;

    // Add main person
    relatives.add(mainPersonId);

    // Add all ancestors (blood relatives going up)
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

    // Add all descendants (blood relatives going down)
    const addDescendants = (personId: string) => {
      const children = getChildren(personId);
      children.forEach(child => {
        relatives.add(child.personId);
        addDescendants(child.personId);
      });
    };
    addDescendants(mainPersonId);

    // Add siblings of main person (they share blood through parents)
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

    // Get current spouse (no divorce date or most recent)
    const getCurrentSpouse = (person: Person): Person | undefined => {
      if (person.spouses.length === 0) return undefined;
      // Find spouse without divorce date (current), or last one
      const currentSpouseEntry = person.spouses.find(s => !s.divorceDate) || person.spouses[person.spouses.length - 1];
      return personMap.get(currentSpouseEntry.spouseId);
    };

    // Get all spouses for a person
    const getAllSpouses = (person: Person): Person[] => {
      return person.spouses
        .map(s => personMap.get(s.spouseId))
        .filter((s): s is Person => !!s);
    };

    // Get display info for a person - main person shows all spouses, others show current only
    const getDisplayInfo = (person: Person, isMainContext: boolean): { main: Person; spouses: Person[] } => {
      const spouses = isMainContext ? getAllSpouses(person) : 
        (getCurrentSpouse(person) ? [getCurrentSpouse(person)!] : []);
      
      // Male on left
      if (person.gender === 'male') {
        return { main: person, spouses };
      } else if (spouses.length > 0 && spouses[0].gender === 'male') {
        // If person is female and has male spouse, swap
        return { main: spouses[0], spouses: [person, ...spouses.slice(1)] };
      }
      return { main: person, spouses };
    };

    // Process ancestors (going up) - show siblings at each level
    const processAncestors = (person: Person, generation: number) => {
      const father = person.fatherId ? personMap.get(person.fatherId) : undefined;
      const mother = person.motherId ? personMap.get(person.motherId) : undefined;

      // Add father (blood relative)
      if (father && !processed.has(father.personId)) {
        processed.add(father.personId);
        addToGeneration({
          person: father,
          x: 0, y: 0,
          generation: generation - 1,
          isBloodRelative: true,
          isSibling: false,
          isCousin: false
        });

        // Father's siblings (shown at same level, on left of father)
        if (showSiblings) {
          const fatherSiblings = getSiblings(father);
          fatherSiblings.forEach(sib => {
            if (!processed.has(sib.personId)) {
              processed.add(sib.personId);
              addToGeneration({
                person: sib,
                x: 0, y: 0,
                generation: generation - 1,
                isBloodRelative: false,
                isSibling: true,
                isCousin: false,
                siblingOfPersonId: father.personId,
                siblingOfGender: 'male' // Father is male, siblings go on left of him
              });
              
              // Add cousins (children of father's siblings) at main person's level
              if (showCousins && generation === 0) {
                const cousins = getChildren(sib.personId);
                cousins.forEach(cousin => {
                  if (!processed.has(cousin.personId)) {
                    processed.add(cousin.personId);
                    addToGeneration({
                      person: cousin,
                      x: 0, y: 0,
                      generation: 0, // Same level as main person
                      isBloodRelative: false,
                      isSibling: false,
                      isCousin: true,
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

      // Add mother (blood relative)
      if (mother && !processed.has(mother.personId)) {
        processed.add(mother.personId);
        addToGeneration({
          person: mother,
          x: 0, y: 0,
          generation: generation - 1,
          isBloodRelative: true,
          isSibling: false,
          isCousin: false
        });

        // Mother's siblings (shown at same level, on right of mother)
        if (showSiblings) {
          const motherSiblings = getSiblings(mother);
          motherSiblings.forEach(sib => {
            if (!processed.has(sib.personId)) {
              processed.add(sib.personId);
              addToGeneration({
                person: sib,
                x: 0, y: 0,
                generation: generation - 1,
                isBloodRelative: false,
                isSibling: true,
                isCousin: false,
                siblingOfPersonId: mother.personId,
                siblingOfGender: 'female' // Mother is female, siblings go on right of her
              });
              
              // Add cousins (children of mother's siblings) at main person's level
              if (showCousins && generation === 0) {
                const cousins = getChildren(sib.personId);
                cousins.forEach(cousin => {
                  if (!processed.has(cousin.personId)) {
                    processed.add(cousin.personId);
                    addToGeneration({
                      person: cousin,
                      x: 0, y: 0,
                      generation: 0, // Same level as main person
                      isBloodRelative: false,
                      isSibling: false,
                      isCousin: true,
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

    // Process descendants (going down)
    const processDescendants = (bloodParentId: string, generation: number) => {
      const children = getChildren(bloodParentId);
      
      children.forEach(child => {
        if (processed.has(child.personId)) return;
        processed.add(child.personId);

        const { main, spouses } = getDisplayInfo(child, false);
        const isChildBlood = bloodRelatives.has(child.personId);
        
        // Determine which parent is blood-related for line drawing
        const bloodParent = bloodRelatives.has(child.fatherId || '') ? child.fatherId : 
                           bloodRelatives.has(child.motherId || '') ? child.motherId : 
                           bloodParentId;

        addToGeneration({
          person: main,
          x: 0, y: 0,
          generation: generation + 1,
          isBloodRelative: isChildBlood,
          isSibling: false,
          isCousin: false,
          spouses: spouses,
          bloodParentId: bloodParent,
          bloodChildId: child.personId // Track the actual blood child
        });

        spouses.forEach(spouse => {
          if (!processed.has(spouse.personId)) {
            processed.add(spouse.personId);
          }
        });

        // Continue with blood-related child
        if (isChildBlood) {
          processDescendants(child.personId, generation + 1);
        }
      });
    };

    // Add main person with all spouses (main person shows all spouses)
    processed.add(mainPerson.personId);
    const { main: displayMain, spouses: displaySpouses } = getDisplayInfo(mainPerson, true);
    
    // Find blood parent for main person's line
    const mainBloodParent = mainPerson.fatherId || mainPerson.motherId;

    addToGeneration({
      person: displayMain,
      x: 0, y: 0,
      generation: 0,
      isBloodRelative: true,
      isSibling: false,
      isCousin: false,
      spouses: displaySpouses,
      bloodParentId: mainBloodParent
    });

    displaySpouses.forEach(spouse => {
      if (!processed.has(spouse.personId)) {
        processed.add(spouse.personId);
      }
    });

    // Add main person's siblings (blood relatives through shared parents)
    if (showSiblings) {
      const mainSiblings = getSiblings(mainPerson);
      mainSiblings.forEach(sib => {
        if (!processed.has(sib.personId)) {
          processed.add(sib.personId);
          addToGeneration({
            person: sib,
            x: 0, y: 0,
            generation: 0,
            isBloodRelative: true, // Siblings share blood
            isSibling: true,
            isCousin: false,
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
      
      // Separate main nodes, siblings, and cousins
      const mainNodes = nodes.filter(n => !n.isSibling && !n.isCousin);
      const siblingNodes = nodes.filter(n => n.isSibling);
      const cousinNodes = nodes.filter(n => n.isCousin);

      // Sort main nodes - main person/couple first at gen 0
      mainNodes.sort((a, b) => {
        if (gen === 0) {
          const aIsMain = a.person.personId === mainPersonId || a.spouses?.some(s => s.personId === mainPersonId);
          const bIsMain = b.person.personId === mainPersonId || b.spouses?.some(s => s.personId === mainPersonId);
          if (aIsMain) return -1;
          if (bIsMain) return 1;
        }
        return 0;
      });
      
      // Helper to calculate node width including all spouses
      const getNodeWidth = (node: NodeLayout): number => {
        const spouseCount = node.spouses?.length || 0;
        if (spouseCount === 0) return NODE_WIDTH;
        return NODE_WIDTH + (spouseCount * (NODE_WIDTH + SPOUSE_GAP));
      };

      // Group siblings by their owner person
      const siblingsByOwner = new Map<string, NodeLayout[]>();
      siblingNodes.forEach(sib => {
        const ownerId = sib.siblingOfPersonId || '';
        if (!siblingsByOwner.has(ownerId)) {
          siblingsByOwner.set(ownerId, []);
        }
        siblingsByOwner.get(ownerId)!.push(sib);
      });

      // Build layout segments: for each main node, include its siblings on appropriate side
      interface Segment {
        leftSiblings: NodeLayout[];
        mainNode: NodeLayout;
        rightSiblings: NodeLayout[];
      }
      const segments: Segment[] = [];

      mainNodes.forEach(node => {
        const personId = node.person.personId;
        const lastSpouseId = node.spouses?.[node.spouses.length - 1]?.personId;
        
        // Siblings of the left person (male) go on left
        const leftSibs = siblingsByOwner.get(personId) || [];
        // Siblings of the right person (last spouse/female) go on right
        const rightSibs = lastSpouseId ? (siblingsByOwner.get(lastSpouseId) || []) : [];
        
        segments.push({
          leftSiblings: leftSibs.filter(s => s.siblingOfGender === 'male'),
          mainNode: node,
          rightSiblings: rightSibs.filter(s => s.siblingOfGender === 'female')
        });
        
        // Also check if the main node person is female (single) - put siblings on right
        if (!node.spouses?.length && node.person.gender === 'female') {
          const femaleSibs = siblingsByOwner.get(personId) || [];
          segments[segments.length - 1].rightSiblings = femaleSibs;
          segments[segments.length - 1].leftSiblings = [];
        }
      });

      // Calculate cousin width
      const cousinWidth = cousinNodes.length * NODE_WIDTH + Math.max(0, cousinNodes.length - 1) * SIBLING_GAP;

      // Calculate total width
      let totalWidth = 0;
      segments.forEach((seg, idx) => {
        const leftW = seg.leftSiblings.length * NODE_WIDTH + Math.max(0, seg.leftSiblings.length - 1) * SIBLING_GAP;
        const mainW = getNodeWidth(seg.mainNode);
        const rightW = seg.rightSiblings.length * NODE_WIDTH + Math.max(0, seg.rightSiblings.length - 1) * SIBLING_GAP;
        
        totalWidth += (seg.leftSiblings.length > 0 ? leftW + SIBLING_GAP : 0) + mainW + 
                      (seg.rightSiblings.length > 0 ? SIBLING_GAP + rightW : 0);
        if (idx < segments.length - 1) totalWidth += H_GAP;
      });
      
      // Add cousin width
      if (cousinNodes.length > 0) {
        totalWidth += H_GAP + cousinWidth;
      }

      let currentX = -totalWidth / 2;
      const y = (gen - minGen) * (NODE_HEIGHT + V_GAP);

      // Position each segment
      segments.forEach((seg, idx) => {
        // Left siblings
        seg.leftSiblings.forEach(sib => {
          sib.x = currentX;
          sib.y = y;
          currentX += NODE_WIDTH + SIBLING_GAP;
        });

        // Main node
        seg.mainNode.x = currentX;
        seg.mainNode.y = y;
        currentX += getNodeWidth(seg.mainNode);

        // Right siblings
        if (seg.rightSiblings.length > 0) {
          currentX += SIBLING_GAP;
          seg.rightSiblings.forEach(sib => {
            sib.x = currentX;
            sib.y = y;
            currentX += NODE_WIDTH + SIBLING_GAP;
          });
          currentX -= SIBLING_GAP; // Remove last gap
        }

        if (idx < segments.length - 1) currentX += H_GAP;
      });

      // Position cousins at the end (right side)
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

  // Full Tree layout - shows ALL members organized by generation
  // Uses iterative constraint propagation to ensure:
  // 1. Spouses are on same generation
  // 2. Siblings are on same generation  
  // 3. Parents are exactly 1 level above children
  const calculateFullTreeLayout = useCallback((): NodeLayout[] => {
    if (!tree || tree.treeData.length === 0) return [];

    const layouts: NodeLayout[] = [];
    const processed = new Set<string>();
    const generationMap = new Map<string, number>();

    // Initialize all to 0
    tree.treeData.forEach(p => generationMap.set(p.personId, 0));

    const getGen = (id: string) => generationMap.get(id) || 0;
    const setGen = (id: string, gen: number) => generationMap.set(id, gen);

    // Get siblings of a person
    const getSiblings = (person: Person): Person[] => {
      return tree.treeData.filter(other => 
        other.personId !== person.personId &&
        ((person.fatherId && person.fatherId === other.fatherId) ||
         (person.motherId && person.motherId === other.motherId))
      );
    };

    // Iteratively apply constraints until stable
    let changed = true;
    let iterations = 0;
    const maxIterations = 200;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Constraint 1: Children must be at least 1 level below parents
      tree.treeData.forEach(person => {
        let requiredGen = getGen(person.personId);
        
        if (person.fatherId) {
          requiredGen = Math.max(requiredGen, getGen(person.fatherId) + 1);
        }
        if (person.motherId) {
          requiredGen = Math.max(requiredGen, getGen(person.motherId) + 1);
        }

        if (requiredGen > getGen(person.personId)) {
          setGen(person.personId, requiredGen);
          changed = true;
        }
      });

      // Constraint 2: Spouses must be on same generation (use max)
      tree.treeData.forEach(person => {
        const personGen = getGen(person.personId);
        person.spouses.forEach(spouseEntry => {
          const spouseGen = getGen(spouseEntry.spouseId);
          const maxGen = Math.max(personGen, spouseGen);
          
          if (getGen(person.personId) < maxGen) {
            setGen(person.personId, maxGen);
            changed = true;
          }
          if (getGen(spouseEntry.spouseId) < maxGen) {
            setGen(spouseEntry.spouseId, maxGen);
            changed = true;
          }
        });
      });

      // Constraint 3: Siblings must be on same generation (use max)
      tree.treeData.forEach(person => {
        const siblings = getSiblings(person);
        if (siblings.length > 0) {
          let maxGen = getGen(person.personId);
          siblings.forEach(sib => {
            maxGen = Math.max(maxGen, getGen(sib.personId));
          });

          if (getGen(person.personId) < maxGen) {
            setGen(person.personId, maxGen);
            changed = true;
          }
          siblings.forEach(sib => {
            if (getGen(sib.personId) < maxGen) {
              setGen(sib.personId, maxGen);
              changed = true;
            }
          });
        }
      });

      // Constraint 4: Parents must be exactly 1 level above their children
      // This pushes parents UP when children are pushed down
      tree.treeData.forEach(person => {
        const personGen = getGen(person.personId);
        const expectedParentGen = personGen - 1;

        if (person.fatherId && getGen(person.fatherId) < expectedParentGen) {
          setGen(person.fatherId, expectedParentGen);
          changed = true;
        }
        if (person.motherId && getGen(person.motherId) < expectedParentGen) {
          setGen(person.motherId, expectedParentGen);
          changed = true;
        }
      });
    }

    // Normalize: shift so minimum generation is 0
    const allGens = Array.from(generationMap.values());
    const minGen = Math.min(...allGens);
    if (minGen !== 0) {
      tree.treeData.forEach(p => {
        setGen(p.personId, getGen(p.personId) - minGen);
      });
    }

    // Helper to get all spouses
    const getAllSpouses = (person: Person): Person[] => {
      return person.spouses
        .map(s => personMap.get(s.spouseId))
        .filter((s): s is Person => !!s);
    };

    // Group by generation and create layouts
    const generationNodes = new Map<number, NodeLayout[]>();

    tree.treeData.forEach(person => {
      if (processed.has(person.personId)) return;

      const gen = getGen(person.personId);
      const spouses = getAllSpouses(person);

      // Determine display order (male on left)
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
        person: displayMain,
        x: 0,
        y: 0,
        generation: gen,
        isBloodRelative: true,
        isSibling: false,
        isCousin: false,
        spouses: displaySpouses
      };

      if (!generationNodes.has(gen)) {
        generationNodes.set(gen, []);
      }
      generationNodes.get(gen)!.push(layout);
      layouts.push(layout);
    });

    // Position nodes by generation
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
  
  // Build position map for all persons including spouses
  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    layouts.forEach(l => {
      map.set(l.person.personId, { x: l.x, y: l.y });
      // Position each spouse
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

    // Draw parent lines helper
    const drawParentLines = (p: Person, pPos: { x: number; y: number }) => {
      const pCenterX = pPos.x + NODE_WIDTH / 2;
      const pTopY = pPos.y;

      // Line to father
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
              <path
                key={key}
                d={`M ${pCenterX} ${pTopY} C ${pCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none"
                stroke="#444"
                strokeWidth={2}
              />
            );
          }
        }
      }

      // Line to mother
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
              <path
                key={key}
                d={`M ${pCenterX} ${pTopY} C ${pCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none"
                stroke="#444"
                strokeWidth={2}
              />
            );
          }
        }
      }
    };

    // Draw connections
    layouts.forEach(layout => {
      const person = layout.person;
      const personPos = getNodePos(person.personId);
      if (!personPos) return;

      // Full Tree mode - no connectors
      if (showFullTree) {
        return;
      }

      // Regular mode logic below
      // Skip drawing parent connections for siblings - they only get horizontal dotted lines
      if (layout.isSibling) return;

      // Draw lines for main person in layout
      if (layout.generation <= 0 && bloodRelatives.has(person.personId)) {
        drawParentLines(person, personPos);
      }

      // Also draw lines for spouses if they're blood relatives
      if (layout.generation <= 0 && layout.spouses) {
        layout.spouses.forEach(spouse => {
          if (bloodRelatives.has(spouse.personId)) {
            const spousePos = getNodePos(spouse.personId);
            if (spousePos) {
              drawParentLines(spouse, spousePos);
            }
          }
        });
      }
      // For descendants (generation > 0): single line from blood parent to blood child
      else if (layout.generation > 0 && layout.bloodParentId && layout.bloodChildId) {
        const parentPos = getNodePos(layout.bloodParentId);
        const bloodChildPos = getNodePos(layout.bloodChildId);
        
        if (parentPos && bloodChildPos) {
          const key = `desc-${layout.bloodParentId}-${layout.bloodChildId}`;
          if (!drawnConnections.has(key)) {
            drawnConnections.add(key);
            
            // Line goes to the actual blood child, not necessarily the left person
            const childCenterX = bloodChildPos.x + NODE_WIDTH / 2;
            const childTopY = bloodChildPos.y;
            const parentCenterX = parentPos.x + NODE_WIDTH / 2;
            const parentBottomY = parentPos.y + NODE_HEIGHT;
            const midY = (childTopY + parentBottomY) / 2;

            elements.push(
              <path
                key={key}
                d={`M ${childCenterX} ${childTopY} C ${childCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`}
                fill="none"
                stroke="#444"
                strokeWidth={2}
              />
            );
          }
        }
      }
    });

    // Draw horizontal dotted lines connecting siblings at each level (not in full tree mode)
    if (showFullTree) return elements;

    const generationGroups = new Map<number, NodeLayout[]>();
    layouts.forEach(l => {
      if (!generationGroups.has(l.generation)) {
        generationGroups.set(l.generation, []);
      }
      generationGroups.get(l.generation)!.push(l);
    });

    generationGroups.forEach((nodes, gen) => {
      const siblingNodes = nodes.filter(n => n.isSibling);
      
      // Group siblings by the person they belong to
      const siblingsByOwner = new Map<string, NodeLayout[]>();
      siblingNodes.forEach(sib => {
        const ownerId = sib.siblingOfPersonId || '';
        if (!siblingsByOwner.has(ownerId)) {
          siblingsByOwner.set(ownerId, []);
        }
        siblingsByOwner.get(ownerId)!.push(sib);
      });

      // Draw connections for each owner's siblings
      siblingsByOwner.forEach((siblings, ownerId) => {
        const ownerPos = positionMap.get(ownerId);
        if (!ownerPos || siblings.length === 0) return;

        const ownerCenterY = ownerPos.y + NODE_HEIGHT / 2;
        const sortedSibs = [...siblings].sort((a, b) => a.x - b.x);
        const isLeftSide = sortedSibs[0].siblingOfGender === 'male';

        if (isLeftSide) {
          // Siblings on left - connect last sibling to owner's left edge
          const lastSib = sortedSibs[sortedSibs.length - 1];
          elements.push(
            <line
              key={`sib-owner-${ownerId}-${gen}`}
              x1={lastSib.x + NODE_WIDTH}
              y1={lastSib.y + NODE_HEIGHT / 2}
              x2={ownerPos.x}
              y2={ownerCenterY}
              stroke="#aaa"
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          );
        } else {
          // Siblings on right - connect owner's right edge to first sibling
          const firstSib = sortedSibs[0];
          elements.push(
            <line
              key={`sib-owner-${ownerId}-${gen}`}
              x1={ownerPos.x + NODE_WIDTH}
              y1={ownerCenterY}
              x2={firstSib.x}
              y2={firstSib.y + NODE_HEIGHT / 2}
              stroke="#aaa"
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          );
        }

        // Lines between siblings
        for (let i = 0; i < sortedSibs.length - 1; i++) {
          elements.push(
            <line
              key={`sib-connect-${ownerId}-${gen}-${i}`}
              x1={sortedSibs[i].x + NODE_WIDTH}
              y1={sortedSibs[i].y + NODE_HEIGHT / 2}
              x2={sortedSibs[i + 1].x}
              y2={sortedSibs[i + 1].y + NODE_HEIGHT / 2}
              stroke="#aaa"
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          );
        }
      });
    });

    return elements;
  };

  // Render animated lineage lines on hover in full tree mode
  const renderHoverLineage = () => {
    if (!showFullTree || !hoveredPersonId || !tree) return null;

    const elements: JSX.Element[] = [];
    const getNodePos = (personId: string) => positionMap.get(personId);
    const drawnConnections = new Set<string>();

    // Check if two people are spouses
    const areSpouses = (person1Id: string, person2Id: string): boolean => {
      const person1 = personMap.get(person1Id);
      if (!person1) return false;
      return person1.spouses.some(s => s.spouseId === person2Id);
    };

    // Connection types
    interface Connection {
      childId: string;
      fatherId?: string;
      motherId?: string;
      isCouple: boolean;  // true if parents are married couple
      level: number;
      direction: 'up' | 'down';
    }
    const connections: Connection[] = [];

    // Collect ancestor connections (going UP)
    const collectAncestors = (personId: string, level: number, visited: Set<string>) => {
      if (visited.has(personId)) return;
      visited.add(personId);

      const person = personMap.get(personId);
      if (!person) return;

      if (person.fatherId || person.motherId) {
        const isCouple = !!(person.fatherId && person.motherId && 
                         areSpouses(person.fatherId, person.motherId));
        
        const connKey = `${personId}-parents`;
        if (!drawnConnections.has(connKey)) {
          drawnConnections.add(connKey);
          connections.push({ 
            childId: personId, 
            fatherId: person.fatherId,
            motherId: person.motherId,
            isCouple,
            level, 
            direction: 'up' 
          });
        }
        
        // Continue up through both parents' lines
        if (person.fatherId) {
          collectAncestors(person.fatherId, level + 1, visited);
        }
        if (person.motherId) {
          collectAncestors(person.motherId, level + 1, visited);
        }
      }
    };

    // Collect descendant connections (going DOWN)
    const collectDescendants = (personId: string, level: number, visited: Set<string>) => {
      if (visited.has(personId)) return;
      visited.add(personId);

      const person = personMap.get(personId);
      if (!person) return;

      // Find children where this person is a parent
      tree.treeData.forEach(child => {
        if (child.fatherId === personId || child.motherId === personId) {
          const connKey = `${child.personId}-to-${personId}`;
          if (!drawnConnections.has(connKey)) {
            drawnConnections.add(connKey);
            
            // Check if both parents exist and are couple
            const otherParentId = child.fatherId === personId ? child.motherId : child.fatherId;
            const isCouple = otherParentId && areSpouses(personId, otherParentId);
            
            connections.push({ 
              childId: child.personId, 
              fatherId: child.fatherId,
              motherId: child.motherId,
              isCouple: !!isCouple,
              level, 
              direction: 'down' 
            });
          }
          collectDescendants(child.personId, level + 1, visited);
        }
      });
    };

    collectAncestors(hoveredPersonId, 0, new Set());
    collectDescendants(hoveredPersonId, 0, new Set());

    // Sort connections by level
    const upConnections = connections.filter(c => c.direction === 'up').sort((a, b) => a.level - b.level);
    const downConnections = connections.filter(c => c.direction === 'down').sort((a, b) => a.level - b.level);

    const drawConnection = (conn: Connection, delay: number, goingDown: boolean) => {
      const childPos = getNodePos(conn.childId);
      if (!childPos) return;

      const childCenterX = childPos.x + NODE_WIDTH / 2;
      const childTopY = childPos.y;

      // Calculate parent position - center of couple if married, otherwise single parent
      let parentCenterX: number;
      let parentBottomY: number;

      if (conn.isCouple && conn.fatherId && conn.motherId) {
        // Parents are a couple - draw to center between them
        const fatherPos = getNodePos(conn.fatherId);
        const motherPos = getNodePos(conn.motherId);
        if (!fatherPos || !motherPos) return;
        
        parentCenterX = (fatherPos.x + NODE_WIDTH / 2 + motherPos.x + NODE_WIDTH / 2) / 2;
        parentBottomY = fatherPos.y + NODE_HEIGHT; // Same row
      } else {
        // Single parent - draw to that parent
        const parentId = conn.fatherId || conn.motherId;
        if (!parentId) return;
        const parentPos = getNodePos(parentId);
        if (!parentPos) return;
        
        parentCenterX = parentPos.x + NODE_WIDTH / 2;
        parentBottomY = parentPos.y + NODE_HEIGHT;
      }

      const midY = (childTopY + parentBottomY) / 2;

      // For upward animation: start from child, go to parent
      // For downward animation: start from parent, go to child
      const pathD = goingDown
        ? `M ${parentCenterX} ${parentBottomY} C ${parentCenterX} ${midY}, ${childCenterX} ${midY}, ${childCenterX} ${childTopY}`
        : `M ${childCenterX} ${childTopY} C ${childCenterX} ${midY}, ${parentCenterX} ${midY}, ${parentCenterX} ${parentBottomY}`;

      elements.push(
        <path
          key={`hover-${conn.childId}-${conn.fatherId || ''}-${conn.motherId || ''}-${goingDown ? 'down' : 'up'}`}
          d={pathD}
          fill="none"
          stroke="#e74c3c"
          strokeWidth={3}
          className="hover-lineage-line"
          style={{ animationDelay: `${delay}ms` }}
        />
      );
    };

    // Draw upward lines first (animation goes up)
    upConnections.forEach((conn, idx) => {
      drawConnection(conn, idx * 150, false);
    });

    // Draw downward lines (animation goes down)
    downConnections.forEach((conn, idx) => {
      drawConnection(conn, idx * 150, true);
    });

    return elements;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-content')) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(0.3, z * delta), 2));
  };

  useEffect(() => {
    if (mainPersonId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: 150 });
    }
  }, [mainPersonId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture arrow keys when focus is on input elements
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (isInputFocused) return;

      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onNavigateBack();
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onNavigateForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigateBack, onNavigateForward]);

  const handleNodeClick = useCallback((personId: string) => {
    onSelectPerson(personId);
    onSetMainPerson(personId);
    // Note: onSetMainPerson in App.tsx handles exiting full tree mode
  }, [onSelectPerson, onSetMainPerson]);

  const handleEditSelected = useCallback(() => {
    if (selectedPersonId) {
      const person = personMap.get(selectedPersonId);
      if (person) onEditPerson(person);
    }
  }, [selectedPersonId, personMap, onEditPerson]);

  const handleAddChildToSelected = useCallback(() => {
    if (selectedPersonId) {
      onAddPerson(selectedPersonId, 'child');
    }
  }, [selectedPersonId, onAddPerson]);

  const handleAddParentToSelected = useCallback(() => {
    if (selectedPersonId) {
      onAddPerson(selectedPersonId, 'parent');
    }
  }, [selectedPersonId, onAddPerson]);

  const handleAddSpouseToSelected = useCallback(() => {
    if (selectedPersonId) {
      onAddPerson(selectedPersonId, 'spouse');
    }
  }, [selectedPersonId, onAddPerson]);

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
          <button className="btn-start" onClick={() => onAddPerson()}>
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
              <button key={p.personId} onClick={() => onSetMainPerson(p.personId)}>
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
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
            <button 
              className="ribbon-btn" 
              onClick={onNavigateBack} 
              disabled={historyIndex <= 0}
              title="Go back (←)"
            >
              ← Back
            </button>
            <button 
              className="ribbon-btn" 
              onClick={onNavigateForward} 
              disabled={historyIndex >= history.length - 1}
              title="Go forward (→)"
            >
              Forward →
            </button>
          </div>
        </div>

        <div className="ribbon-divider" />

        <div className="ribbon-section">
          <span className="ribbon-label">View</span>
          <div className="ribbon-buttons">
            <button 
              className={`ribbon-btn toggle ${showFullTree ? 'active' : 'inactive'}`}
              onClick={onToggleFullTree}
              title="Show Full Tree (all members)"
            >
              🌳 Full Tree
            </button>
            <button 
              className={`ribbon-btn toggle ${showSiblings ? 'active' : 'inactive'}`}
              onClick={onToggleSiblings}
              disabled={showFullTree}
              title="Show/Hide Siblings"
            >
              👥 Siblings
            </button>
            <button 
              className={`ribbon-btn toggle ${showCousins ? 'active' : 'inactive'}`}
              onClick={onToggleCousins}
              disabled={showFullTree}
              title="Show/Hide Cousins"
            >
              👨‍👩‍👧‍👦 Cousins
            </button>
          </div>
        </div>

        <div className="ribbon-divider" />

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

        <div className="ribbon-section">
          <span className="ribbon-label">Actions</span>
          <div className="ribbon-buttons">
            <button className="ribbon-btn primary" onClick={() => onAddPerson()}>
              + Add Person
            </button>
          </div>
        </div>

        <div className="ribbon-spacer" />

        <div className="ribbon-info">
          <span className="tree-title">{tree.treeName}</span>
          {!showFullTree && defaultPersonId && (
            <span className="main-person-badge" title="Default Person">
              ★ {personMap.get(defaultPersonId)?.firstName}
            </span>
          )}
          {showFullTree && (
            <span className="full-tree-badge">Full Tree View</span>
          )}
        </div>
      </div>

      <div
        className="canvas-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg 
          className="connections-svg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }}
        >
          <g transform="translate(0, 0)">
            {renderConnections()}
            {renderHoverLineage()}
          </g>
        </svg>

        {layouts.map(layout => (
          <React.Fragment key={layout.person.personId}>
            <PersonNode
              person={layout.person}
              x={layout.x}
              y={layout.y}
              isSelected={!showFullTree && selectedPersonId === layout.person.personId}
              isMainPerson={!showFullTree && mainPersonId === layout.person.personId}
              isDefaultPerson={!showFullTree && defaultPersonId === layout.person.personId}
              isBloodRelative={showFullTree || bloodRelatives.has(layout.person.personId)}
              isSibling={!showFullTree && layout.isSibling}
              isCousin={!showFullTree && layout.isCousin}
              hasSpouseAdjacent={(layout.spouses?.length || 0) > 0}
              onSelect={() => handleNodeClick(layout.person.personId)}
              onHover={showFullTree ? setHoveredPersonId : undefined}
              isHovered={showFullTree && hoveredPersonId === layout.person.personId}
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
                isSibling={false}
                isCousin={false}
                hasSpouseAdjacent={idx < (layout.spouses?.length || 1) - 1}
                isSpousePosition={true}
                onSelect={() => handleNodeClick(spouse.personId)}
                onHover={showFullTree ? setHoveredPersonId : undefined}
                isHovered={showFullTree && hoveredPersonId === spouse.personId}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Floating bottom toolbar for selected person (not in full tree mode) */}
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
            <button className="toolbar-btn" onClick={handleEditSelected} title="Edit Person">
              ✎ Edit
            </button>
            <button className="toolbar-btn" onClick={handleAddParentToSelected} title="Add Parent">
              ↑ Parent
            </button>
            <button className="toolbar-btn" onClick={handleAddChildToSelected} title="Add Child">
              ↓ Child
            </button>
            <button className="toolbar-btn" onClick={handleAddSpouseToSelected} title="Add Spouse">
              ♥ Spouse
            </button>
            {defaultPersonId !== selectedPerson.personId && (
              <button 
                className="toolbar-btn default" 
                onClick={() => onSetDefaultPerson(selectedPerson.personId)} 
                title="Set as Default"
              >
                ★ Default
              </button>
            )}
            <button className="toolbar-btn close" onClick={() => onSelectPerson(null)} title="Close">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
