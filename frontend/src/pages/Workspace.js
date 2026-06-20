import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

/* ─── Action definitions ───────────────────────────────────────────────────── */
const ACTIONS = [
  { id: 'chat',       icon: '💬', label: 'Ask a question',     desc: 'Free-form RAG Q&A from your notes',   needsTopic: false },
  { id: 'explain',    icon: '🧠', label: 'Explain a topic',    desc: 'Deep explanation from your notes',     needsTopic: true  },
  { id: 'summarise',  icon: '📋', label: 'Summarise note',     desc: 'Key bullet-point summary',             needsTopic: false },
  { id: 'flashcards', icon: '🃏', label: 'Generate flashcards',desc: 'Auto-generate & save flashcards',      needsTopic: false, needsCount: true },
  { id: 'quiz',       icon: '📝', label: 'Quiz me',            desc: 'Generate an MCQ quiz',                 needsTopic: false, needsCount: true },
];

/* ─── Single message bubble ────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom:12 }}>
      <div style={{
        maxWidth:'82%', padding:'10px 14px', borderRadius:14, fontSize:14, lineHeight:1.7,
        background: isUser ? '#534AB7' : '#F4F3FF',
        color:      isUser ? '#fff'    : '#1A1A18',
        borderBottomRightRadius: isUser ? 2 : 14,
        borderBottomLeftRadius:  isUser ? 14 : 2,
        whiteSpace: 'pre-wrap',
      }}>
        {/* Action badge */}
        {!isUser && msg.action && msg.action !== 'chat' && (
          <div style={{ fontSize:11, fontWeight:600, color:'#534AB7', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {ACTIONS.find(a => a.id === msg.action)?.icon} {ACTIONS.find(a => a.id === msg.action)?.label}
          </div>
        )}
        {msg.text}
        {/* Sources */}
        {msg.sources?.length > 0 && (
          <div style={{ marginTop:8, fontSize:12, color:'#9E9C93', borderTop:'1px solid rgba(83,74,183,0.15)', paddingTop:6 }}>
            📚 From: {msg.sources.join(', ')}
          </div>
        )}
        {/* Flashcard shortcut */}
        {msg.action === 'flashcards' && msg.noteId && (
          <Link to={`/notes/${msg.noteId}/flashcards`}
            style={{ display:'inline-block', marginTop:8, fontSize:12, color:'#534AB7', fontWeight:500 }}>
            Open Flashcards →
          </Link>
        )}
        {/* Quiz shortcut - triggers quiz UI inline */}
        {msg.action === 'quiz' && msg.questions && (
          <div style={{ marginTop:8, fontSize:12, color:'#534AB7', fontWeight:500, cursor:'pointer' }}
            onClick={() => msg.onOpenQuiz?.(msg.questions, msg.noteId)}>
            Start Quiz →
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Inline quiz component ────────────────────────────────────────────────── */
function InlineQuiz({ questions, noteId, onClose }) {
  const [answers, setAnswers]   = useState({});
  const [result, setResult]     = useState(null);
  const [submitting, setSubmit] = useState(false);

  const submit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Answer all questions first'); return;
    }
    setSubmit(true);
    try {
      const res = await api.post('/quiz/submit', { noteId, questions, userAnswers: answers });
      setResult(res.data);
    } catch { toast.error('Submit failed'); }
    finally { setSubmit(false); }
  };

  const scoreColor = !result ? '' : result.percentage >= 70 ? '#085041' : result.percentage >= 40 ? '#633806' : '#712B13';
  const scoreBg    = !result ? '' : result.percentage >= 70 ? '#E1F5EE' : result.percentage >= 40 ? '#FAEEDA' : '#FAECE7';

  return (
    <div style={{ background:'#fff', border:'1px solid rgba(83,74,183,0.2)', borderRadius:14, padding:'1.25rem', margin:'0 0 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
        <span style={{ fontWeight:600, fontSize:15 }}>📝 Quiz ({questions.length} questions)</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9E9C93', fontSize:18 }}>✕</button>
      </div>

      {result && (
        <div style={{ background:scoreBg, borderRadius:10, padding:'0.75rem 1rem', textAlign:'center', marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:24, color:scoreColor }}>{result.percentage}%</span>
          <span style={{ color:scoreColor, marginLeft:8, fontSize:14 }}>{result.score}/{result.total} correct</span>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {questions.map((q, qi) => {
          const resultQ    = result?.quizResult?.questions?.[qi];
          const submitted  = !!result;
          return (
            <div key={qi} style={{ background:'#F9F9F9', borderRadius:10, padding:'0.875rem' }}>
              <p style={{ fontWeight:500, fontSize:13, marginBottom:8 }}>{qi+1}. {q.question}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {q.options.map((opt, oi) => {
                  const selected  = answers[qi] === opt;
                  const isCorrect = submitted && opt === q.correctAnswer;
                  const isWrong   = submitted && selected && !isCorrect;
                  return (
                    <button key={oi} disabled={submitted}
                      onClick={() => setAnswers({ ...answers, [qi]: opt })}
                      style={{
                        textAlign:'left', padding:'7px 12px', borderRadius:8, fontSize:13, cursor: submitted ? 'default' : 'pointer',
                        border: '1px solid',
                        background: isCorrect ? '#E1F5EE' : isWrong ? '#FAECE7' : selected ? '#EEEDFE' : '#fff',
                        borderColor: isCorrect ? '#1D9E75' : isWrong ? '#D85A30' : selected ? '#534AB7' : '#E0DED5',
                        color: isCorrect ? '#085041' : isWrong ? '#712B13' : selected ? '#3C3489' : '#1A1A18',
                      }}>
                      {opt} {isCorrect ? '✓' : isWrong ? '✗' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!result && (
        <button onClick={submit} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:12 }} disabled={submitting}>
          {submitting ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/> : 'Submit Quiz'}
        </button>
      )}
    </div>
  );
}

/* ─── Main Workspace component ─────────────────────────────────────────────── */
export default function Workspace() {
  const { noteId }   = useParams();
  const navigate     = useNavigate();

  const [notes, setNotes]           = useState([]);
  const [selectedNote, setSelectedNote] = useState(noteId || null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [topic, setTopic]           = useState('');
  const [count, setCount]           = useState(10);
  const [action, setAction]         = useState('chat');
  const [loading, setLoading]       = useState(false);
  const [remaining, setRemaining]   = useState(null);
  const [quizData, setQuizData]     = useState(null); // { questions, noteId }
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef();

  // ── Load notes and history on mount ──────────────────────────────────────
  useEffect(() => {
    api.get('/workspace/notes-with-chunks')
      .then(r => {
        setNotes(r.data.notes);
        setRemaining(r.data.remainingCalls);
      })
      .catch(() => {
        // fallback: load all notes
        api.get('/notes').then(r => setNotes(r.data.notes)).catch(() => {});
      });
  }, []);

  useEffect(() => {
    setLoadingHistory(true);
    const q = selectedNote ? `?noteId=${selectedNote}` : '';
    api.get(`/workspace/history${q}`)
      .then(r => {
        const msgs = (r.data.messages || []).map(m => ({ ...m, id: Math.random() }));
        if (msgs.length === 0) {
          msgs.push({
            id: 'intro', role: 'model', action: 'chat',
            text: selectedNote
              ? `Hi! I've indexed your note. Ask me anything about it, or choose an action below.`
              : `Hi! I can answer questions across ALL your notes at once — just ask me anything. Select a specific note above to use note-specific features.`,
          });
        }
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [selectedNote]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, quizData]);

  // ── Send action ───────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const currentAction = action;
    const currentInput  = input.trim();
    const currentTopic  = topic.trim();
    const currentNoteId = selectedNote;

    // Validation
    if (currentAction === 'chat' && !currentInput) { toast.error('Type a message'); return; }
    if (currentAction === 'explain' && !currentTopic) { toast.error('Enter a topic to explain'); return; }
    if (['flashcards','quiz','summarise'].includes(currentAction) && !currentNoteId) {
      toast.error('Select a specific note for this action'); return;
    }

    // Optimistic user bubble
    const userText =
      currentAction === 'chat'      ? currentInput :
      currentAction === 'explain'   ? `Explain: ${currentTopic}` :
      currentAction === 'summarise' ? 'Summarise this note' :
      currentAction === 'flashcards'? `Generate ${count} flashcards` :
      `Quiz me with ${count} questions`;

    const userMsg = { id: Date.now(), role:'user', text: userText, action: currentAction };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const payload = {
        action: currentAction,
        noteId: currentNoteId || undefined,
        message: currentAction === 'chat' ? currentInput : undefined,
        topic:   currentAction === 'explain' ? currentTopic : undefined,
        count:   ['flashcards','quiz'].includes(currentAction) ? count : undefined,
      };

      const res = await api.post('/workspace/action', payload);
      setRemaining(res.data.remainingCalls);

      let modelText = '';
      let extra = {};

      if (currentAction === 'chat') {
        modelText = res.data.reply;
        extra = { sources: res.data.sources };
      } else if (currentAction === 'explain') {
        modelText = res.data.reply;
      } else if (currentAction === 'summarise') {
        modelText = res.data.reply;
      } else if (currentAction === 'flashcards') {
        modelText = res.data.message;
        extra = { noteId: currentNoteId };
      } else if (currentAction === 'quiz') {
        modelText = res.data.message;
        extra = { questions: res.data.questions, noteId: res.data.noteId };
        setQuizData({ questions: res.data.questions, noteId: res.data.noteId });
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1, role:'model', action: currentAction, text: modelText, ...extra,
        onOpenQuiz: (qs, nid) => setQuizData({ questions: qs, noteId: nid }),
      }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Something went wrong';
      toast.error(errMsg);
      setMessages(prev => [...prev, { id: Date.now()+1, role:'model', action: currentAction, text: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }, [action, input, topic, count, selectedNote]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear chat history for this session?')) return;
    const q = selectedNote ? `?noteId=${selectedNote}` : '';
    await api.delete(`/workspace/history${q}`).catch(() => {});
    setMessages([{ id:'intro', role:'model', action:'chat', text: 'History cleared. Ask me anything!' }]);
    setQuizData(null);
  };

  const selectedNoteObj = notes.find(n => n._id === selectedNote);
  const noteSpecificAction = ['flashcards','quiz','summarise'].includes(action);

  return (
    <div style={{ height:'calc(100vh - 60px)', display:'flex', flexDirection:'column', background:'#F9F9F9' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.08)',
        padding:'10px 1.5rem', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}>
        {/* Note selector */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:13, color:'#5F5E5A', whiteSpace:'nowrap', fontWeight:500 }}>Note:</label>
          <select
            value={selectedNote || ''}
            onChange={e => {
              setSelectedNote(e.target.value || null);
              setQuizData(null);
              if (e.target.value) navigate(`/workspace/${e.target.value}`, { replace:true });
              else navigate('/workspace', { replace:true });
            }}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #E0DED5', fontSize:14, minWidth:200 }}
          >
            <option value="">🌐 All notes (global RAG)</option>
            {notes.map(n => <option key={n._id} value={n._id}>{n.title}</option>)}
          </select>
        </div>

        {/* Action selector */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {ACTIONS.map(a => (
            <button key={a.id} onClick={() => setAction(a.id)}
              disabled={noteSpecificAction && !selectedNote && ['flashcards','quiz','summarise'].includes(a.id)}
              title={a.desc}
              style={{
                padding:'5px 12px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer',
                border:'1px solid',
                background: action === a.id ? '#534AB7' : '#fff',
                borderColor: action === a.id ? '#534AB7' : '#E0DED5',
                color:   action === a.id ? '#fff' : '#5F5E5A',
                opacity: (noteSpecificAction && !selectedNote && ['flashcards','quiz','summarise'].includes(a.id)) ? 0.4 : 1,
              }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        {/* Remaining calls + clear */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          {remaining !== null && (
            <span style={{ fontSize:12, color: remaining < 5 ? '#D85A30' : '#9E9C93' }}>
              {remaining} AI calls left today
            </span>
          )}
          {selectedNoteObj && (
            <Link to={`/notes/${selectedNoteObj._id}/flashcards`} className="btn btn-outline btn-sm">
              🃏 View Flashcards
            </Link>
          )}
          <button onClick={clearHistory} className="btn btn-outline btn-sm" style={{ color:'#D85A30', borderColor:'#D85A30' }}>
            Clear history
          </button>
        </div>
      </div>

      {/* ── Sub-inputs (topic / count) ──────────────────────────────────────── */}
      {(action === 'explain' || ['flashcards','quiz'].includes(action)) && (
        <div style={{ background:'#EEEDFE', padding:'8px 1.5rem', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(83,74,183,0.15)' }}>
          {action === 'explain' && (
            <input
              type="text" placeholder="Topic to explain (e.g. 'Krebs cycle', 'React hooks')"
              value={topic} onChange={e => setTopic(e.target.value)}
              style={{ flex:1, padding:'7px 12px', borderRadius:8, border:'1px solid rgba(83,74,183,0.25)', fontSize:14 }}
            />
          )}
          {['flashcards','quiz'].includes(action) && (
            <>
              <label style={{ fontSize:13, color:'#3C3489', fontWeight:500 }}>
                {action === 'flashcards' ? 'Cards:' : 'Questions:'}
              </label>
              <select value={count} onChange={e => setCount(Number(e.target.value))}
                style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(83,74,183,0.25)', fontSize:14 }}>
                {(action === 'flashcards' ? [5,10,15,20] : [3,5,8,10]).map(n =>
                  <option key={n} value={n}>{n}</option>
                )}
              </select>
            </>
          )}
          {action !== 'explain' && (
            <span style={{ fontSize:12, color:'#534AB7' }}>
              {action === 'flashcards'
                ? `Will generate ${count} flashcards from "${selectedNoteObj?.title || '...'}" and save them`
                : `Will generate a ${count}-question quiz from "${selectedNoteObj?.title || '...'}"`}
            </span>
          )}
        </div>
      )}

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column' }}>
        {loadingHistory ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner"/></div>
        ) : (
          <>
            {/* Context pill */}
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <span style={{
                fontSize:12, padding:'4px 12px', borderRadius:99,
                background: selectedNote ? '#E1F5EE' : '#EEEDFE',
                color:      selectedNote ? '#085041' : '#3C3489', fontWeight:500,
              }}>
                {selectedNote
                  ? `📄 Note: ${selectedNoteObj?.title || '...'} — answers grounded in this note`
                  : `🌐 Global RAG — searching across all ${notes.length} of your notes`}
              </span>
            </div>

            {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}

            {/* Inline quiz */}
            {quizData && (
              <InlineQuiz
                questions={quizData.questions}
                noteId={quizData.noteId}
                onClose={() => setQuizData(null)}
              />
            )}

            {loading && (
              <div style={{ display:'flex', marginBottom:12 }}>
                <div style={{ background:'#F4F3FF', padding:'10px 14px', borderRadius:14, borderBottomLeftRadius:2, display:'flex', alignItems:'center', gap:8 }}>
                  <div className="spinner" style={{ width:16, height:16, borderWidth:2 }}/>
                  <span style={{ fontSize:13, color:'#534AB7' }}>Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </>
        )}
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div style={{
        background:'#fff', borderTop:'1px solid rgba(0,0,0,0.08)',
        padding:'12px 1.5rem', display:'flex', gap:10, alignItems:'flex-end',
      }}>
        {action === 'chat' ? (
          <textarea
            rows={2}
            placeholder={selectedNote
              ? `Ask anything about "${selectedNoteObj?.title || 'this note'}"…`
              : 'Ask anything across all your notes…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            style={{
              flex:1, padding:'10px 14px', borderRadius:10,
              border:'1px solid #E0DED5', fontSize:14, resize:'none',
              fontFamily:'inherit', lineHeight:1.5,
            }}
          />
        ) : (
          <div style={{
            flex:1, padding:'10px 14px', borderRadius:10,
            border:'1px dashed #C5C2F0', background:'#FAFAFE',
            fontSize:14, color:'#9E9C93', display:'flex', alignItems:'center',
          }}>
            {ACTIONS.find(a => a.id === action)?.icon}&nbsp;
            {action === 'explain'    ? 'Enter topic above and click Send' :
             action === 'summarise'  ? `Will summarise "${selectedNoteObj?.title || 'selected note'}"` :
             action === 'flashcards' ? `Will generate ${count} flashcards` :
             `Will generate ${count} quiz questions`}
          </div>
        )}
        <button
          onClick={send}
          disabled={loading || (action === 'chat' && !input.trim()) || (action === 'explain' && !topic.trim())}
          className="btn btn-primary"
          style={{ padding:'10px 22px', alignSelf:'stretch' }}
        >
          {loading
            ? <span className="spinner" style={{ width:16, height:16, borderWidth:2 }}/>
            : action === 'chat' ? 'Send' : `Run ${ACTIONS.find(a=>a.id===action)?.icon}`}
        </button>
      </div>
    </div>
  );
}
