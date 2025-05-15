import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="footer-logo-text">trap.</span>
          </div>
          <div className="footer-info">
            <p>&copy; {new Date().getFullYear()} trap. All rights reserved.</p>
            <p className="footer-small">
              Please drink responsibly. Must be 18+ to consume alcohol in Australia.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}