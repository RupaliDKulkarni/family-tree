import React, { useState, useEffect, useMemo } from 'react';
import { Person, FamilyTree } from '../../types';
import { generatePersonId } from '../../utils/storage';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import './PersonSlider.css';

interface PersonSliderProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  tree: FamilyTree | null;
  relationContext?: {
    parentId: string;
    relation: 'child' | 'parent' | 'spouse';
  };
  onSave: (person: Person, relationContext?: { parentId: string; relation: 'child' | 'parent' | 'spouse' }) => void;
  onDelete?: (personId: string) => void;
}

const emptyPerson: Omit<Person, 'personId'> = {
  firstName: '',
  lastName: '',
  gender: 'male',
  dob: '',
  dod: '',
  address: '',
  notes: '',
  spouses: []
};

const PersonSlider: React.FC<PersonSliderProps> = ({
  isOpen,
  onClose,
  person,
  tree,
  relationContext,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Person>({ ...emptyPerson, personId: '' });
  const [selectedFatherId, setSelectedFatherId] = useState<string>('');
  const [selectedMotherId, setSelectedMotherId] = useState<string>('');
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEditing = !!person;

  // Get available members for dropdowns
  const males = useMemo(() => 
    tree?.treeData.filter(p => p.gender === 'male' && p.personId !== formData.personId) || [],
    [tree, formData.personId]
  );
  
  const females = useMemo(() => 
    tree?.treeData.filter(p => p.gender === 'female' && p.personId !== formData.personId) || [],
    [tree, formData.personId]
  );

  const potentialSpouses = useMemo(() => 
    tree?.treeData.filter(p => p.gender !== formData.gender && p.personId !== formData.personId) || [],
    [tree, formData.gender, formData.personId]
  );

  useEffect(() => {
    if (person) {
      setFormData(person);
      setSelectedFatherId(person.fatherId || '');
      setSelectedMotherId(person.motherId || '');
      setSelectedSpouseId(person.spouses[0]?.spouseId || '');
    } else {
      setFormData({ ...emptyPerson, personId: generatePersonId() });
      
      // Pre-populate parents when adding a child
      if (relationContext?.relation === 'child' && tree) {
        const parent = tree.treeData.find(p => p.personId === relationContext.parentId);
        if (parent) {
          if (parent.gender === 'male') {
            setSelectedFatherId(parent.personId);
            // Set mother if parent has a spouse
            const spouse = parent.spouses[0];
            setSelectedMotherId(spouse?.spouseId || '');
          } else {
            setSelectedMotherId(parent.personId);
            // Set father if parent has a spouse
            const spouse = parent.spouses[0];
            setSelectedFatherId(spouse?.spouseId || '');
          }
        }
      } else {
        setSelectedFatherId('');
        setSelectedMotherId('');
      }
      setSelectedSpouseId('');
    }
  }, [person, isOpen, relationContext, tree]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditing) {
      // For new person, check if any field has been filled
      return formData.firstName.trim() !== '' || 
             formData.lastName.trim() !== '' ||
             formData.dob !== '' ||
             formData.dod !== '' ||
             formData.address.trim() !== '' ||
             formData.notes.trim() !== '';
    }
    // For editing, compare with original
    return formData.firstName !== person?.firstName ||
           formData.lastName !== person?.lastName ||
           formData.gender !== person?.gender ||
           formData.dob !== person?.dob ||
           formData.dod !== (person?.dod || '') ||
           formData.address !== person?.address ||
           formData.notes !== person?.notes ||
           selectedFatherId !== (person?.fatherId || '') ||
           selectedMotherId !== (person?.motherId || '') ||
           selectedSpouseId !== (person?.spouses[0]?.spouseId || '');
  }, [formData, person, isEditing, selectedFatherId, selectedMotherId, selectedSpouseId]);

  const handleOverlayClick = () => {
    if (!hasChanges) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      alert('First name is required');
      return;
    }
    
    // Update person with selected relations
    const updatedPerson: Person = {
      ...formData,
      fatherId: selectedFatherId || undefined,
      motherId: selectedMotherId || undefined,
    };

    // Handle spouse changes
    if (selectedSpouseId) {
      const existingSpouse = formData.spouses.find(s => s.spouseId === selectedSpouseId);
      if (existingSpouse) {
        updatedPerson.spouses = [existingSpouse];
      } else {
        updatedPerson.spouses = [{ spouseId: selectedSpouseId, marriageDate: '', divorceDate: '' }];
      }
    } else {
      updatedPerson.spouses = [];
    }

    onSave(updatedPerson, relationContext);
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (person && onDelete) {
      onDelete(person.personId);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const getTitle = () => {
    if (isEditing) return `Edit: ${person.firstName}`;
    if (relationContext) {
      const parentPerson = tree?.treeData.find(p => p.personId === relationContext.parentId);
      switch (relationContext.relation) {
        case 'child': return `Add Child of ${parentPerson?.firstName || ''}`;
        case 'parent': return `Add Parent of ${parentPerson?.firstName || ''}`;
        case 'spouse': return `Add Spouse of ${parentPerson?.firstName || ''}`;
      }
    }
    return 'Add Person';
  };

  if (!isOpen) return null;

  return (
    <div className={`slider-overlay ${isOpen ? 'open' : ''}`} onClick={handleOverlayClick}>
      <div className="slider-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slider-header">
          <h3>{getTitle()}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="slider-form">
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Enter first name"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Last Name</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Enter last name"
            />
          </div>

          <div className="form-group">
            <label>Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Date of Death</label>
              <input
                type="date"
                name="dod"
                value={formData.dod || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-section">
            <label className="section-label">Family Relations</label>
            
            <div className="form-group">
              <label>Father</label>
              <select 
                value={selectedFatherId} 
                onChange={(e) => setSelectedFatherId(e.target.value)}
              >
                <option value="">-- No Father --</option>
                {males.map(p => (
                  <option key={p.personId} value={p.personId}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Mother</label>
              <select 
                value={selectedMotherId} 
                onChange={(e) => setSelectedMotherId(e.target.value)}
              >
                <option value="">-- No Mother --</option>
                {females.map(p => (
                  <option key={p.personId} value={p.personId}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Spouse</label>
              <select 
                value={selectedSpouseId} 
                onChange={(e) => setSelectedSpouseId(e.target.value)}
              >
                <option value="">-- No Spouse --</option>
                {potentialSpouses.map(p => (
                  <option key={p.personId} value={p.personId}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter address"
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="slider-actions">
            <button type="submit" className="btn-save">
              {isEditing ? 'Update' : 'Add Person'}
            </button>
            {isEditing && onDelete && (
              <button type="button" className="btn-delete" onClick={handleDelete}>
                Delete
              </button>
            )}
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Remove Member"
          message={`Remove ${person?.firstName} ${person?.lastName} from this tree? Their relationships will also be removed.`}
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    </div>
  );
};

export default PersonSlider;
