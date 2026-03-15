import React, { useState, useEffect, useMemo } from 'react';
import { Person } from '../../types';
import { useTree } from '../../hooks/useTree';
import { useUI } from '../../hooks/useUI';
import { generatePersonId } from '../../utils/storage';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import './PersonSlider.css';

const emptyPerson: Omit<Person, 'personId'> = {
  firstName: '',
  lastName: '',
  gender: 'male',
  dob: '',
  dod: '',
  address: '',
  notes: '',
  spouses: [],
  lifeEvents: [],
};

const PersonSlider: React.FC = () => {
  const { currentTree, savePerson, deletePerson, linkExistingSpouse, updateSpouseDates, deleteSpouse } = useTree();
  const { sliderOpen, editingPerson: person, relationContext, closeSlider } = useUI();

  const tree = currentTree;
  const isOpen = sliderOpen;
  const onClose = closeSlider;

  const [formData, setFormData] = useState<Person>({ ...emptyPerson, personId: '' });
  const [selectedFatherId, setSelectedFatherId] = useState<string>('');
  const [selectedMotherId, setSelectedMotherId] = useState<string>('');
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSpouseDeleteConfirm, setShowSpouseDeleteConfirm] = useState(false);
  const [spouseToDelete, setSpouseToDelete] = useState<{ spouseId: string; spouseName: string } | null>(null);
  const [spouseMode, setSpouseMode] = useState<'existing' | 'select' | 'new'>('existing');
  const [marriageDate, setMarriageDate] = useState('');
  const [divorceDate, setDivorceDate] = useState('');
  const [editingSpouseId, setEditingSpouseId] = useState<string | null>(null);
  const isEditing = !!person;

  const isSpouseRelation = !isEditing && relationContext?.relation === 'spouse';

  const parentPerson = useMemo(() =>
    relationContext ? tree?.treeData.find(p => p.personId === relationContext.parentId) : undefined,
    [tree, relationContext]
  );

  const parentSpousesWithDetails = useMemo(() => {
    if (!parentPerson || !tree) return [];
    return parentPerson.spouses.map(s => {
      const spouseDetails = tree.treeData.find(p => p.personId === s.spouseId);
      return {
        ...s,
        spouseName: spouseDetails ? `${spouseDetails.firstName} ${spouseDetails.lastName || ''}`.trim() : 'Unknown'
      };
    });
  }, [parentPerson, tree]);

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

  const oppositeSexPersons = useMemo(() => {
    if (!tree || !parentPerson || !isSpouseRelation) return [];
    const oppositeGender = parentPerson.gender === 'male' ? 'female' : 'male';
    const existingSpouseIds = parentPerson.spouses.map(s => s.spouseId);
    return tree.treeData.filter(p =>
      p.gender === oppositeGender &&
      p.personId !== parentPerson.personId &&
      !existingSpouseIds.includes(p.personId)
    );
  }, [tree, parentPerson, isSpouseRelation]);

  useEffect(() => {
    if (person) {
      setFormData(person);
      setSelectedFatherId(person.fatherId || '');
      setSelectedMotherId(person.motherId || '');
      setSelectedSpouseId(person.spouses[0]?.spouseId || '');
    } else {
      const newPerson: Person = { ...emptyPerson, personId: generatePersonId() };

      if (relationContext?.relation === 'spouse' && tree) {
        const parent = tree.treeData.find(p => p.personId === relationContext.parentId);
        if (parent) {
          newPerson.gender = parent.gender === 'male' ? 'female' : 'male';
        }
      }

      setFormData(newPerson);

      if (relationContext?.relation === 'child' && tree) {
        const parent = tree.treeData.find(p => p.personId === relationContext.parentId);
        if (parent) {
          if (parent.gender === 'male') {
            setSelectedFatherId(parent.personId);
            const spouse = parent.spouses[0];
            setSelectedMotherId(spouse?.spouseId || '');
          } else {
            setSelectedMotherId(parent.personId);
            const spouse = parent.spouses[0];
            setSelectedFatherId(spouse?.spouseId || '');
          }
        }
      } else {
        setSelectedFatherId('');
        setSelectedMotherId('');
      }
      setSelectedSpouseId('');
      setSpouseMode('existing');
      setMarriageDate('');
      setDivorceDate('');
      setEditingSpouseId(null);
    }
  }, [person, isOpen, relationContext, tree]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const hasChanges = useMemo(() => {
    if (!isEditing) {
      if (isSpouseRelation && spouseMode === 'select') {
        return selectedSpouseId !== '' || marriageDate !== '' || divorceDate !== '';
      }
      return formData.firstName.trim() !== '' ||
             formData.lastName.trim() !== '' ||
             formData.dob !== '' ||
             formData.dod !== '' ||
             formData.address.trim() !== '' ||
             formData.notes.trim() !== '' ||
             marriageDate !== '' ||
             divorceDate !== '';
    }
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
  }, [formData, person, isEditing, selectedFatherId, selectedMotherId, selectedSpouseId, isSpouseRelation, spouseMode, marriageDate, divorceDate]);

  const handleOverlayClick = () => {
    if (!hasChanges) onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSpouseRelation && editingSpouseId && relationContext) {
      updateSpouseDates(relationContext.parentId, editingSpouseId, marriageDate, divorceDate);
      setEditingSpouseId(null);
      setMarriageDate('');
      setDivorceDate('');
      onClose();
      return;
    }

    if (isSpouseRelation && spouseMode === 'select') {
      if (!selectedSpouseId) { alert('Please select a person'); return; }
      if (relationContext) {
        linkExistingSpouse(selectedSpouseId, relationContext.parentId, marriageDate, divorceDate);
      }
      onClose();
      return;
    }

    if (!formData.firstName.trim()) { alert('First name is required'); return; }

    const updatedPerson: Person = {
      ...formData,
      fatherId: selectedFatherId || undefined,
      motherId: selectedMotherId || undefined,
      lifeEvents: formData.lifeEvents || [],
    };

    if (isSpouseRelation && spouseMode === 'new' && relationContext) {
      updatedPerson.spouses = [{ spouseId: relationContext.parentId, marriageDate, divorceDate }];
    } else if (selectedSpouseId) {
      const existingSpouse = formData.spouses.find(s => s.spouseId === selectedSpouseId);
      if (existingSpouse) {
        updatedPerson.spouses = [existingSpouse];
      } else {
        updatedPerson.spouses = [{ spouseId: selectedSpouseId, marriageDate: '', divorceDate: '' }];
      }
    } else {
      updatedPerson.spouses = [];
    }

    savePerson(updatedPerson, relationContext);
    onClose();
  };

  const handleEditSpouse = (spouse: { spouseId: string; marriageDate: string; divorceDate: string }) => {
    setEditingSpouseId(spouse.spouseId);
    setMarriageDate(spouse.marriageDate);
    setDivorceDate(spouse.divorceDate);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (person) {
      deletePerson(person.personId);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleDeleteSpouse = (spouseId: string, spouseName: string) => {
    setSpouseToDelete({ spouseId, spouseName });
    setShowSpouseDeleteConfirm(true);
  };

  const confirmDeleteSpouse = () => {
    if (spouseToDelete && relationContext) {
      deleteSpouse(relationContext.parentId, spouseToDelete.spouseId);
      setSpouseToDelete(null);
      setShowSpouseDeleteConfirm(false);
    }
  };

  const cancelDeleteSpouse = () => {
    setSpouseToDelete(null);
    setShowSpouseDeleteConfirm(false);
  };

  const getTitle = () => {
    if (isEditing) return `Edit: ${person.firstName}`;
    if (relationContext) {
      const parentName = parentPerson?.firstName || '';
      switch (relationContext.relation) {
        case 'child': return `Add Child of ${parentName}`;
        case 'parent': return `Add Parent of ${parentName}`;
        case 'spouse':
          if (editingSpouseId) return `Update Spouse of ${parentName}`;
          return spouseMode === 'new'
            ? `Add New Spouse for ${parentName}`
            : spouseMode === 'select'
            ? `Add Spouse of ${parentName}`
            : `Manage Spouses of ${parentName}`;
      }
    }
    return 'Add Person';
  };

  if (!isOpen) return null;

  const renderExistingSpouses = () => (
    <>
      <div className="form-section">
        <label className="section-label">Current Spouses</label>
        {parentSpousesWithDetails.length === 0 ? (
          <p style={{ color: '#777', fontStyle: 'italic' }}>No spouses added yet</p>
        ) : (
          <div className="spouses-list">
            {parentSpousesWithDetails.map(spouse => (
              <div key={spouse.spouseId} className="spouse-item">
                <div className="spouse-item-info">
                  <strong>{spouse.spouseName}</strong>
                  <div className="spouse-dates">Married: {spouse.marriageDate || 'Not specified'}</div>
                  <div className="spouse-dates">Divorced: {spouse.divorceDate || 'Not specified'}</div>
                </div>
                <div className="spouse-item-actions">
                  <button type="button" className="btn-update-spouse" onClick={() => handleEditSpouse(spouse)}>Update</button>
                  <button type="button" className="btn-delete-spouse" onClick={() => handleDeleteSpouse(spouse.spouseId, spouse.spouseName)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingSpouseId && (
        <div className="form-section">
          <label className="section-label">Update Marriage Details</label>
          <div className="form-group">
            <label>Spouse</label>
            <input type="text" value={parentSpousesWithDetails.find(s => s.spouseId === editingSpouseId)?.spouseName || ''} disabled />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Marriage Date</label>
              <input type="date" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Divorce Date</label>
              <input type="date" value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <button type="button" className="btn-add-new-spouse" onClick={() => { setSpouseMode('select'); setEditingSpouseId(null); }}>
          + Add Another Spouse
        </button>
      </div>

      <div className="slider-actions">
        {editingSpouseId ? (
          <>
            <button type="submit" className="btn-save">Save Changes</button>
            <button type="button" className="btn-cancel" onClick={() => { setEditingSpouseId(null); setMarriageDate(''); setDivorceDate(''); }}>Cancel Update</button>
          </>
        ) : (
          <button type="button" className="btn-cancel" onClick={onClose}>Close</button>
        )}
      </div>
    </>
  );

  const renderSpouseSelectMode = () => (
    <>
      <button type="button" className="btn-back-to-select" onClick={() => setSpouseMode('existing')}>
        &larr; Back to existing spouses
      </button>

      <div className="form-group">
        <label>Select Spouse</label>
        <select value={selectedSpouseId} onChange={(e) => setSelectedSpouseId(e.target.value)} autoFocus>
          <option value="">-- Select Person --</option>
          {oppositeSexPersons.map(p => (
            <option key={p.personId} value={p.personId}>{p.firstName} {p.lastName}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Marriage Date</label>
          <input type="date" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Divorce Date</label>
          <input type="date" value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <button type="button" className="btn-add-new-spouse" onClick={() => setSpouseMode('new')}>+ Add New Person</button>
      </div>

      <div className="slider-actions">
        <button type="submit" className="btn-save">Link Spouse</button>
        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
      </div>
    </>
  );

  const renderNewPersonForm = () => (
    <>
      {isSpouseRelation && spouseMode === 'new' && (
        <button type="button" className="btn-back-to-select" onClick={() => setSpouseMode('select')}>
          &larr; Back to select existing person
        </button>
      )}

      <div className="form-group">
        <label>First Name *</label>
        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Enter first name" autoFocus />
      </div>

      <div className="form-group">
        <label>Last Name</label>
        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Enter last name" />
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
          <input type="date" name="dob" value={formData.dob} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Date of Death</label>
          <input type="date" name="dod" value={formData.dod || ''} onChange={handleChange} />
        </div>
      </div>

      {isSpouseRelation && spouseMode === 'new' ? (
        <div className="form-section">
          <label className="section-label">Spouse Details</label>
          <div className="form-group">
            <label>Spouse</label>
            <input type="text" value={`${parentPerson?.firstName || ''} ${parentPerson?.lastName || ''}`.trim()} disabled />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Marriage Date</label>
              <input type="date" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Divorce Date</label>
              <input type="date" value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="form-section">
          <label className="section-label">Family Relations</label>

          <div className="form-group">
            <label>Father</label>
            <select value={selectedFatherId} onChange={(e) => setSelectedFatherId(e.target.value)}>
              <option value="">-- No Father --</option>
              {males.map(p => (
                <option key={p.personId} value={p.personId}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Mother</label>
            <select value={selectedMotherId} onChange={(e) => setSelectedMotherId(e.target.value)}>
              <option value="">-- No Mother --</option>
              {females.map(p => (
                <option key={p.personId} value={p.personId}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Spouse</label>
            <select value={selectedSpouseId} onChange={(e) => setSelectedSpouseId(e.target.value)}>
              <option value="">-- No Spouse --</option>
              {potentialSpouses.map(p => (
                <option key={p.personId} value={p.personId}>{p.firstName} {p.lastName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Address</label>
        <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Enter address" />
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." rows={3} />
      </div>

      <div className="slider-actions">
        <button type="submit" className="btn-save">{isEditing ? 'Update' : 'Add Person'}</button>
        {isEditing && (
          <button type="button" className="btn-delete" onClick={handleDelete}>Delete</button>
        )}
        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
      </div>
    </>
  );

  return (
    <div className={`slider-overlay ${isOpen ? 'open' : ''}`} onClick={handleOverlayClick}>
      <div className="slider-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slider-header">
          <h3>{getTitle()}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="slider-form">
          {isSpouseRelation ? (
            spouseMode === 'existing' ? renderExistingSpouses() :
            spouseMode === 'select' ? renderSpouseSelectMode() :
            renderNewPersonForm()
          ) : renderNewPersonForm()}
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

        <ConfirmModal
          isOpen={showSpouseDeleteConfirm}
          title="Remove Spouse"
          message={`Remove ${spouseToDelete?.spouseName} as spouse? This will remove the marriage relationship from both people.`}
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={confirmDeleteSpouse}
          onCancel={cancelDeleteSpouse}
        />
      </div>
    </div>
  );
};

export default PersonSlider;
