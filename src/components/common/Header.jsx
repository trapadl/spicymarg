import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo-link">
            <div className="logo">
              <span className="logo-text">trap.</span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}