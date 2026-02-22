import React from 'react';
import { Person } from '../../types';
import './PersonNode.css';

interface PersonNodeProps {
  person: Person;
  x: number;
  y: number;
  isSelected: boolean;
  isMainPerson: boolean;
  isDefaultPerson: boolean;
  isBloodRelative: boolean;
  isSibling: boolean;
  isCousin: boolean;
  hasSpouseAdjacent: boolean;
  isSpousePosition?: boolean;
  onSelect: () => void;
  onHover?: (personId: string | null) => void;
  isHovered?: boolean;
}

const PersonNode: React.FC<PersonNodeProps> = ({
  person,
  x,
  y,
  isSelected,
  isMainPerson,
  isDefaultPerson,
  isBloodRelative,
  isSibling,
  isCousin,
  hasSpouseAdjacent,
  isSpousePosition,
  onSelect,
  onHover,
  isHovered
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  const isDeceased = !!person.dod;

  // Calculate age
  const calculateAge = (): number | null => {
    if (!person.dob) return null;
    const birthDate = new Date(person.dob);
    const endDate = person.dod ? new Date(person.dod) : new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge();
  
  const nodeClasses = [
    'person-node',
    person.gender,
    isSelected ? 'selected' : '',
    isMainPerson ? 'main-person' : '',
    isBloodRelative ? 'blood-relative' : 'non-blood',
    isSibling ? 'sibling' : '',
    isCousin ? 'cousin' : '',
    isDeceased ? 'deceased' : '',
    hasSpouseAdjacent && !isSpousePosition ? 'has-spouse-right' : '',
    isSpousePosition ? 'spouse-position' : '',
    isHovered ? 'hovered' : ''
  ].filter(Boolean).join(' ');

  const handleMouseEnter = () => {
    if (onHover) onHover(person.personId);
  };

  const handleMouseLeave = () => {
    if (onHover) onHover(null);
  };

  return (
    <div
      className={nodeClasses}
      style={{ left: x, top: y }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`person-name ${isMainPerson ? 'bold' : ''}`}>
        {person.firstName}
      </div>
      <div className="person-lastname">
        {person.lastName}
      </div>
      {person.dod && <div className="deceased-marker">†</div>}
      {isDefaultPerson && <div className="main-marker">★</div>}
      {age !== null && (
        <div className="age-tooltip">
          {isDeceased ? `Died at ${age}` : `Age: ${age}`}
        </div>
      )}
    </div>
  );
};

export default PersonNode;
