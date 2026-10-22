import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard';
import School from './components/School';
import Content from './components/Content';
import Agency from './components/Agency';
import WeeklyPlanning from './components/WeeklyPlanning';

export default function App() {
  // Handle OAuth callback toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calAuth') === 'success') {
      console.log('[Jarvis] Google Calendar connected!');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/school" element={<School />} />
            <Route path="/content" element={<Content />} />
            <Route path="/agency" element={<Agency />} />
            <Route path="/planning" element={<WeeklyPlanning />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
