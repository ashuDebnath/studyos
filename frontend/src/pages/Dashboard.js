import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [notes, setNotes]           = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/notes').then(r => setNotes(r.data.notes.slice(0, 5))),
      api.get('/quiz/results').then(r => setQuizResults(r.data.results.slice(0, 5))),
    ]).finally(() => setLoading(false));
  }, []);

  const avgScore = quizResults.length
    ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length)
    : 0;

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="spinner"/></div>;

  return (
    <div className="page-container">
      <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
      <p className="page-subtitle">Here's your study overview</p>

      {/* AI Workspace CTA */}
      <div style={{
        background:'linear-gradient(135deg, #534AB7 0%, #3C3489 100%)',
        borderRadius:14, padding:'1.25rem 1.5rem', marginBottom:24,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div>
          <p style={{ color:'rgba(255,255,255,0.75)', fontSize:13, marginBottom:4 }}>✨ New</p>
          <p style={{ color:'#fff', fontWeight:600, fontSize:16 }}>AI Workspace with RAG</p>
          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:13 }}>Ask questions across all your notes, generate flashcards, quiz yourself — in one place.</p>
        </div>
        <Link to="/workspace" style={{
          background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)',
          padding:'9px 20px', borderRadius:8, fontSize:14, fontWeight:500, textDecoration:'none',
          whiteSpace:'nowrap',
        }}>
          Open Workspace →
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:28 }}>
        {[
          { label:'Study Streak', value: user?.streak ? `${user.streak} days 🔥` : '0 days', bg:'#FAEEDA', color:'#633806' },
          { label:'Notes',        value: notes.length,            bg:'#EEEDFE', color:'#3C3489' },
          { label:'Quizzes',      value: user?.totalQuizzesTaken || 0, bg:'#E1F5EE', color:'#085041' },
          { label:'Avg Score',    value: quizResults.length ? `${avgScore}%` : '—', bg:'#FAECE7', color:'#712B13' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:'0.875rem 1.125rem' }}>
            <p style={{ fontSize:12, fontWeight:500, color:s.color, marginBottom:4 }}>{s.label}</p>
            <p style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
        {/* Recent notes */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h2 style={{ fontSize:16, fontWeight:600 }}>Recent Notes</h2>
            <Link to="/notes" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          {notes.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem' }}>
              <p style={{ color:'#5F5E5A', marginBottom:12, fontSize:14 }}>No notes yet</p>
              <Link to="/notes" className="btn btn-primary btn-sm">Upload your first note</Link>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {notes.map(note => (
                <div key={note._id} className="card" style={{ padding:'0.875rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <p style={{ fontWeight:500, fontSize:14, marginBottom:4 }}>{note.title}</p>
                    <span className="badge badge-purple">{note.subject}</span>
                  </div>
                  <Link to={`/workspace/${note._id}`} className="btn btn-secondary btn-sm">Ask AI</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent quizzes */}
        <div>
          <h2 style={{ fontSize:16, fontWeight:600, marginBottom:12 }}>Recent Quiz Results</h2>
          {quizResults.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'2rem' }}>
              <p style={{ color:'#5F5E5A', fontSize:14 }}>No quizzes yet. Open the AI Workspace to take your first quiz.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {quizResults.map(r => (
                <div key={r._id} className="card" style={{ padding:'0.875rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <p style={{ fontWeight:500, fontSize:14 }}>{r.note?.title || 'Unknown Note'}</p>
                    <p style={{ fontSize:12, color:'#5F5E5A' }}>{r.score}/{r.total} correct</p>
                  </div>
                  <span style={{
                    fontWeight:700, fontSize:16, color:
                      r.percentage >= 70 ? '#085041' : r.percentage >= 40 ? '#633806' : '#712B13'
                  }}>{r.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
