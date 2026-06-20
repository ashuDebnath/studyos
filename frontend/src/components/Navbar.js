import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/notes',     label: 'My Notes' },
  { to: '/workspace', label: '✨ AI Workspace' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <nav style={{
      background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)',
      padding:'0 1.5rem', position:'sticky', top:0, zIndex:100,
      display:'flex', alignItems:'center', height:60, gap:8,
    }}>
      <Link to="/dashboard" style={{ fontWeight:700, fontSize:18, color:'#534AB7', textDecoration:'none', marginRight:24 }}>
        StudyOS
      </Link>
      <div style={{ display:'flex', gap:4, flex:1 }}>
        {navLinks.map(l => (
          <Link key={l.to} to={l.to} style={{
            padding:'6px 14px', borderRadius:8, fontWeight:500, fontSize:14,
            textDecoration:'none',
            background: pathname.startsWith(l.to) ? '#EEEDFE' : 'transparent',
            color:      pathname.startsWith(l.to) ? '#3C3489' : '#5F5E5A',
          }}>
            {l.label}
          </Link>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {user?.streak > 0 && <span style={{ fontSize:13, color:'#D85A30', fontWeight:500 }}>🔥 {user.streak}d streak</span>}
        <span style={{ fontSize:14, color:'#5F5E5A' }}>Hi, {user?.name?.split(' ')[0]}</span>
        <button onClick={logout} className="btn btn-outline btn-sm">Logout</button>
      </div>
    </nav>
  );
}
