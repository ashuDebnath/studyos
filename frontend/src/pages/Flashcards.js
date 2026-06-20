import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

function FlipCard({ card, onReview }) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    setFlipped(!flipped);
    if (!flipped) onReview(card._id);
  };

  const diffColor = { easy:'#085041', medium:'#633806', hard:'#712B13' };
  const diffBg   = { easy:'#E1F5EE', medium:'#FAEEDA', hard:'#FAECE7' };

  return (
    <div onClick={handleFlip} style={{
      cursor:'pointer', perspective:1000,
      minHeight:200,
    }}>
      <div style={{
        position:'relative', minHeight:200,
        transition:'transform 0.4s', transformStyle:'preserve-3d',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front */}
        <div style={{
          position:'absolute', width:'100%', minHeight:200,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          background:'#fff', border:'1px solid rgba(0,0,0,0.1)',
          borderRadius:14, padding:'1.5rem', display:'flex',
          flexDirection:'column', justifyContent:'space-between',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:11, color:'#9E9C93' }}>Question — tap to reveal</span>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, fontWeight:500,
              background:diffBg[card.difficulty], color:diffColor[card.difficulty] }}>
              {card.difficulty}
            </span>
          </div>
          <p style={{ fontSize:16, fontWeight:500, lineHeight:1.6, flex:1, display:'flex', alignItems:'center' }}>
            {card.question}
          </p>
        </div>
        {/* Back */}
        <div style={{
          position:'absolute', width:'100%', minHeight:200,
          backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
          transform:'rotateY(180deg)',
          background:'#534AB7', border:'1px solid #3C3489',
          borderRadius:14, padding:'1.5rem', display:'flex',
          flexDirection:'column', justifyContent:'space-between',
        }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>Answer</span>
          <p style={{ fontSize:16, lineHeight:1.6, color:'#fff', flex:1, display:'flex', alignItems:'center' }}>
            {card.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Flashcards() {
  const { id: noteId } = useParams();
  const [flashcards, setFlashcards] = useState([]);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(10);

  useEffect(() => {
    Promise.all([
      api.get(`/notes/${noteId}`).then(r => setNote(r.data.note)),
      api.get(`/flashcards/${noteId}`).then(r => setFlashcards(r.data.flashcards)),
    ]).finally(() => setLoading(false));
  }, [noteId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/flashcards/generate/${noteId}`, { count });
      setFlashcards(res.data.flashcards);
      toast.success(`${res.data.count} flashcards generated!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const handleReview = async (cardId) => {
    try { await api.patch(`/flashcards/${cardId}/review`); } catch {}
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="spinner"/></div>;

  return (
    <div className="page-container">
      <div style={{ marginBottom:4 }}>
        <Link to={`/notes/${noteId}`} style={{ color:'#5F5E5A', fontSize:14 }}>← {note?.title}</Link>
      </div>
      <h1 className="page-title">Flashcards</h1>
      <p className="page-subtitle">{flashcards.length} cards · tap a card to reveal the answer</p>

      {/* Generate controls */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, padding:'1rem 1.25rem' }}>
        <label style={{ fontSize:14, color:'#5F5E5A', whiteSpace:'nowrap' }}>Generate</label>
        <select value={count} onChange={e => setCount(Number(e.target.value))}
          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #E0DED5', fontSize:14 }}>
          {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} cards</option>)}
        </select>
        <button onClick={generate} className="btn btn-primary" disabled={generating}>
          {generating ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }}/> Generating...</> : '✨ Generate with Gemini'}
        </button>
        <Link to={`/notes/${noteId}/quiz`} className="btn btn-secondary" style={{ marginLeft:'auto' }}>
          Take Quiz instead →
        </Link>
      </div>

      {flashcards.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🃏</div>
          <h3>No flashcards yet</h3>
          <p>Click "Generate with Gemini" to create flashcards from your notes</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {flashcards.map(card => (
            <FlipCard key={card._id} card={card} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
}
