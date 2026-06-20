import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('pdf'); // 'pdf' | 'text'
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title:'', subject:'', textContent:'' });
  const [file, setFile] = useState(null);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await api.get('/notes');
      setNotes(res.data.notes);
    } catch { toast.error('Failed to load notes'); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      if (tab === 'pdf') {
        if (!file) { toast.error('Select a PDF file'); setUploading(false); return; }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', form.title || file.name.replace('.pdf',''));
        fd.append('subject', form.subject);
        await api.post('/notes', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      } else {
        if (!form.title || !form.textContent) { toast.error('Title and content are required'); setUploading(false); return; }
        await api.post('/notes/text', { title:form.title, subject:form.subject, textContent:form.textContent });
      }
      toast.success('Note saved!');
      setShowForm(false);
      setForm({ title:'', subject:'', textContent:'' });
      setFile(null);
      fetchNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note and all its flashcards?')) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes(notes.filter(n => n._id !== id));
      toast.success('Note deleted');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="spinner"/></div>;

  return (
    <div className="page-container">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 className="page-title">My Notes</h1>
          <p className="page-subtitle">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="card" style={{ marginBottom:24 }}>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {['pdf','text'].map(t => (
              <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab===t ? 'btn-primary' : 'btn-outline'}`}>
                {t === 'pdf' ? '📄 Upload PDF' : '✏️ Write Notes'}
              </button>
            ))}
          </div>
          <form onSubmit={handleUpload}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" placeholder="e.g. Chapter 3 – Photosynthesis"
                  value={form.title} onChange={e => setForm({...form, title:e.target.value})} />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input type="text" placeholder="e.g. Biology, Math..."
                  value={form.subject} onChange={e => setForm({...form, subject:e.target.value})} />
              </div>
            </div>
            {tab === 'pdf' ? (
              <div className="form-group">
                <label>PDF File (max 10 MB)</label>
                <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="form-group">
                <label>Note Content</label>
                <textarea placeholder="Paste or type your notes here..." style={{ minHeight:180 }}
                  value={form.textContent} onChange={e => setForm({...form, textContent:e.target.value})} />
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }}/> Saving...</> : 'Save Note'}
            </button>
          </form>
        </div>
      )}

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>No notes yet</h3>
          <p>Upload a PDF or write your first note to get started</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {notes.map(note => (
            <div key={note._id} className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <p style={{ fontWeight:600, fontSize:15, marginBottom:6 }}>{note.title}</p>
                <span className="badge badge-purple">{note.subject}</span>
              </div>
              <p style={{ fontSize:12, color:'#9E9C93', marginTop:'auto' }}>
                {new Date(note.createdAt).toLocaleDateString()}
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Link to={`/workspace/${note._id}`} className="btn btn-primary btn-sm">✨ Ask AI</Link>
                <Link to={`/workspace/${note._id}`} className="btn btn-secondary btn-sm">Open</Link>
                <Link to={`/notes/${note._id}/flashcards`} className="btn btn-outline btn-sm">Flashcards</Link>
                <Link to={`/notes/${note._id}/quiz`} className="btn btn-outline btn-sm">Quiz</Link>
                <button onClick={() => handleDelete(note._id)} className="btn btn-danger btn-sm" style={{ marginLeft:'auto' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
