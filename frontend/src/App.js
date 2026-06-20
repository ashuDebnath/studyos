import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import Notes       from './pages/Notes';
import Workspace   from './pages/Workspace';
import Flashcards  from './pages/Flashcards';
import Quiz        from './pages/Quiz';
import Navbar      from './components/Navbar';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex',justifyContent:'center',alignItems:'center',height:'100vh' }}><div className="spinner"/></div>;
  return user ? children : <Navigate to="/login" />;
};
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" /> : children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/"           element={<Navigate to="/dashboard" />} />
        <Route path="/login"      element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"   element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/notes"      element={<PrivateRoute><Notes /></PrivateRoute>} />
        {/* Unified AI Workspace — per-note or global */}
        <Route path="/workspace"          element={<PrivateRoute><Workspace /></PrivateRoute>} />
        <Route path="/workspace/:noteId"  element={<PrivateRoute><Workspace /></PrivateRoute>} />
        {/* Keep standalone flashcard/quiz pages for direct links */}
        <Route path="/notes/:id/flashcards" element={<PrivateRoute><Flashcards /></PrivateRoute>} />
        <Route path="/notes/:id/quiz"       element={<PrivateRoute><Quiz /></PrivateRoute>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
