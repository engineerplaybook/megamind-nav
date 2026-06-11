import React from 'react';

interface NavbarProps {
  assetBase?: string;
}

const Navbar: React.FC<NavbarProps> = ({ assetBase = '/' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  const isBlogsActive = pathname === '/' || pathname.startsWith('/blogs');
  const isTutorialsActive = pathname.startsWith('/tutorials');
  const isTeamActive = pathname.startsWith('/profile');

  const navLinks = [
    { href: '/blogs', label: 'Blogs', isActive: isBlogsActive },
    { href: '/tutorials', label: 'Tutorials', isActive: isTutorialsActive },
    { href: '/profile', label: 'Team', isActive: isTeamActive },
  ];

  return (
    <nav data-topnav className="navbar">
      <div className="container">
        <a href="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
          <img src={`${assetBase}logo.svg`} alt="Engineer Playbook Logo" style={{ height: '32px', width: '32px' }} />
          Engineer Playbook
        </a>

        <button
          className="menu-toggle"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          <span style={{ fontSize: '1.5rem' }}>☰</span>
        </button>

        <div className={`nav-links ${isOpen ? 'active' : ''}`}>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link ${link.isActive ? 'active' : ''}`}
              aria-current={link.isActive ? 'page' : undefined}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
