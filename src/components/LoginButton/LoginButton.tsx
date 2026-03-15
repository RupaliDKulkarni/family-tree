import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './LoginButton.css';

interface LoginButtonProps {
  variant?: 'landing' | 'sidebar' | 'ribbon';
}

const LoginButton: React.FC<LoginButtonProps> = ({ variant = 'sidebar' }) => {
  const { user, isLoggedIn, isAuthLoading, isFirebaseConfigured, signIn, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  console.log("@@ isFirebaseConfigured : {isFirebaseConfigured}", isFirebaseConfigured);

  // if (!isFirebaseConfigured) {
  //   return (
  //     <button
  //       disabled
  //       className={`login-btn ${variant}`}        
  //       title="Firebase not configured. Add config to .env file."
  //     >
  //       Login
  //     </button>
  //   );
  // }

  if (isAuthLoading) {
    return <span className={`login-loading ${variant}`}>...</span>;
  }

  if (!isLoggedIn) {
    return (
      <button className={`login-btn ${variant}`} onClick={signIn}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div className={`login-user ${variant}`} ref={dropdownRef}>
      <button
        className="login-user-toggle"
        onClick={() => setDropdownOpen(prev => !prev)}
      > 
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="login-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="login-avatar-placeholder">
            {user?.displayName?.[0] || '?'}
          </span>
        )}
        <span className="login-name">{user?.displayName || user?.email || 'User'}</span>
        <span className="login-caret">▾</span>
      </button>
      {dropdownOpen && (
        <div className="login-dropdown">
          <div className="login-dropdown-info">
            <span className="login-dropdown-email">{user?.email}</span>
          </div>
          <button className="login-dropdown-signout" onClick={() => { signOut(); setDropdownOpen(false); }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginButton;
