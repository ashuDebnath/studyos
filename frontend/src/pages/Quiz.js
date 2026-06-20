import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Quiz() {
  const { id: noteId } = useParams();
  const [note, setNote] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(5);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    api.get(`/notes/${noteId}`).then(r => setNote(r.data.note)).catch(() => {});
  }, [noteId]);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setUserAnswers({});
    try {
      const res = await api.post(`/quiz/generate/${noteId}`, { count });
      setQuestions(res.data.questions);
      setGenerated(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate quiz');
    } finally { setLoading(false); }
  };

  const submitQuiz = async () => {
    if (Object.keys(userAnswers).length < questions.length) {
      toast.error('Answer all questions first');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/quiz/submit', { noteId, questions, userAnswers });
      setResult(res.data);
    } catch { toast.error('Submit failed'); }
    finally { setSubmitting(false); }
  };

  const scoreColor = !result ? '' : result.percentage >= 70 ? '#085041' : result.percentage >= 40 ? '#633806' : '#712B13';
  const scoreBg    = !result ? '' : result.percentage >= 70 ? '#E1F5EE'  : result.percentage >= 40 ? '#FAEEDA' : '#FAECE7';

  return (
    <div className="page-container" style={{ maxWidth:720 }}>
      <Link to={`/notes/${noteId}`} style={{ color:'#5F5E5A', fontSize:14 }}>← {note?.title}</Link>
      <h1 className="page-title" style={{ marginTop:4 }}>Quiz</h1>

      {/* Generate controls */}
      {!generated && (
        <div className="card" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, padding:'1rem 1.25rem' }}>
          <label style={{ fontSize:14, color:'#5F5E5A' }}>Questions</label>
          <select value={count} onChange={e => setCount(Number(e.target.value))}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #E0DED5', fontSize:14 }}>
            {[3,5,8,10].map(n => <option key={n} value={n}>{n} questions</option>)}
          </select>
          <button onClick={generate} className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }}/> Generating...</> : '✨ Generate Quiz'}
          </button>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div style={{ background:scoreBg, borderRadius:12, padding:'1.25rem', marginBottom:24, textAlign:'center' }}>
          <p style={{ fontSize:32, fontWeight:700, color:scoreColor }}>{result.percentage}%</p>
          <p style={{ color:scoreColor, fontWeight:500 }}>{result.score} / {result.total} correct</p>
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}>
            <button onClick={() => { setGenerated(false); setQuestions([]); setResult(null); }} className="btn btn-outline btn-sm">
              Try Again
            </button>
            <Link to={`/notes/${noteId}/flashcards`} className="btn btn-secondary btn-sm">
              Review Flashcards
            </Link>
          </div>
        </div>
      )}

      {/* Questions */}
      {questions.map((q, qi) => {
        const submitted = !!result;
        const resultQ = result?.quizResult?.questions?.[qi];
        return (
          <div key={qi} className="card" style={{ marginBottom:16 }}>
            <p style={{ fontWeight:600, marginBottom:12, fontSize:15 }}>
              {qi + 1}. {q.question}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {q.options.map((opt, oi) => {
                const selected = userAnswers[qi] === opt;
                const isCorrect = submitted && opt === q.correctAnswer;
                const isWrong   = submitted && selected && opt !== q.correctAnswer;

                let bg = '#fff', border = '1px solid #E0DED5', color = '#1A1A18';
                if (!submitted && selected) { bg='#EEEDFE'; border='1px solid #534AB7'; color='#3C3489'; }
                if (isCorrect) { bg='#E1F5EE'; border='1px solid #1D9E75'; color='#085041'; }
                if (isWrong)   { bg='#FAECE7'; border='1px solid #D85A30'; color='#712B13'; }

                return (
                  <button key={oi} disabled={submitted}
                    onClick={() => setUserAnswers({ ...userAnswers, [qi]: opt })}
                    style={{ textAlign:'left', padding:'10px 14px', borderRadius:8,
                      background:bg, border, color, fontSize:14, cursor:submitted?'default':'pointer',
                      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>{opt}</span>
                    {isCorrect && <span>✓</span>}
                    {isWrong   && <span>✗</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {questions.length > 0 && !result && (
        <button onClick={submitQuiz} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} disabled={submitting}>
          {submitting ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }}/> Submitting...</> : 'Submit Quiz'}
        </button>
      )}
    </div>
  );
}
