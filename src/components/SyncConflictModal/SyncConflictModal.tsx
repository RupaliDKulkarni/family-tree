import React from 'react';
import './SyncConflictModal.css';

export interface SyncConflict {
  treeId: string;
  treeName: string;
  localModifyDate: string;
  cloudModifyDate: string;
  driveFileId: string;
}

interface SyncConflictModalProps {
  conflict: SyncConflict | null;
  onKeepLocal: (conflict: SyncConflict) => void;
  onKeepCloud: (conflict: SyncConflict) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ conflict, onKeepLocal, onKeepCloud }) => {
  if (!conflict) return null;

  return (
    <div className="sync-conflict-overlay">
      <div className="sync-conflict-modal">
        <div className="sync-conflict-header">
          <h3>Sync Conflict</h3>
        </div>
        <div className="sync-conflict-body">
          <p className="sync-conflict-treename">{conflict.treeName}</p>
          <p className="sync-conflict-desc">
            This tree has been modified in both your local storage and Google Drive.
            Which version would you like to keep?
          </p>
          <div className="sync-conflict-versions">
            <div className="sync-version local">
              <span className="sync-version-label">Local</span>
              <span className="sync-version-date">{formatDate(conflict.localModifyDate)}</span>
            </div>
            <div className="sync-version cloud">
              <span className="sync-version-label">Google Drive</span>
              <span className="sync-version-date">{formatDate(conflict.cloudModifyDate)}</span>
            </div>
          </div>
        </div>
        <div className="sync-conflict-actions">
          <button className="sync-btn keep-local" onClick={() => onKeepLocal(conflict)}>
            Keep Local
          </button>
          <button className="sync-btn keep-cloud" onClick={() => onKeepCloud(conflict)}>
            Keep Cloud
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictModal;
