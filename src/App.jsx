import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './App.css';

// ─────────────────────────────────────────────
// Konfigurasi Mode Pomodoro
// ─────────────────────────────────────────────
const MODES = {
  focus: { label: 'Focus', duration: 25 * 60, color: '#818cf8', shadow: 'rgba(129,140,248,0.55)' },
  short: { label: 'Short Break', duration: 5 * 60, color: '#4ade80', shadow: 'rgba(74,222,128,0.55)' },
  long: { label: 'Long Break', duration: 15 * 60, color: '#60a5fa', shadow: 'rgba(96,165,250,0.55)' },
};
const RADIUS = 110;
const CIRC = 2 * Math.PI * RADIUS;

// ─── Helper: Greeting based on time ───
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 17) return 'Selamat Siang';
  if (h < 20) return 'Selamat Sore';
  return 'Selamat Malam';
};

// ─── Helper: Streak tier ───
const getStreakTier = (streak) => {
  if (streak >= 30) return { class: 'streak-gold', icon: '👑' };
  if (streak >= 7) return { class: 'streak-silver', icon: '⚡' };
  return { class: 'streak-bronze', icon: '🔥' };
};

function App() {
  // ══════════════════════════════════════════════
  // 1. STATE GLOBAL
  // ══════════════════════════════════════════════
  const [token, setToken] = useState(localStorage.getItem('auth_token') || '');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tasks, setTasks] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [habits, setHabits] = useState([]);
  const [stats, setStats] = useState({ tasks: [], habits: [], moods: [] });
  const [user, setUser] = useState({ name: '', level: 1, experience: 0 });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [newDiary, setNewDiary] = useState({ title: '', content: '', mood: 'Neutral' });

  // ── Pomodoro State ──
  const [pomMode, setPomMode] = useState('focus');
  const [timeLeft, setTimeLeft] = useState(MODES.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [sessCount, setSessCount] = useState(0);

  const timerRef = useRef(null);
  const completeRef = useRef(null);  // selalu up-to-date tanpa dep loop

  const baseUrl = import.meta.env.VITE_API_URL || 'https://lifehub-webapp-production.up.railway.app/api.';
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // ══════════════════════════════════════════════
  // 2. AUTH & DATA FETCHING
  // ══════════════════════════════════════════════
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${baseUrl}/login`, { email, password });
      localStorage.setItem('auth_token', res.data.access_token);
      setToken(res.data.access_token);
      Swal.fire({ icon: 'success', title: 'Berhasil Masuk!', background: '#0d0d1a', color: '#fff', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'Email atau password salah.', background: '#0d0d1a', color: '#fff' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken('');
    setActiveTab('dashboard');
  };

  const fetchUserData = async () => { try { const r = await axios.get(`${baseUrl}/user`); setUser(r.data); } catch (e) { console.log(e); } };
  const fetchAllData = async () => {
    try {
      const [rT, rD, rH] = await Promise.all([axios.get(`${baseUrl}/tasks`), axios.get(`${baseUrl}/diaries`), axios.get(`${baseUrl}/habits`)]);
      setTasks(rT.data.data); setDiaries(rD.data.data); setHabits(rH.data.data);
    } catch (err) { if (err.response?.status === 401) handleLogout(); }
  };
  const fetchStats = async () => { try { const r = await axios.get(`${baseUrl}/stats`); setStats(r.data.data); } catch (e) { console.log(e); } };

  useEffect(() => { if (token) { fetchUserData(); fetchAllData(); fetchStats(); } }, [token]);

  // ══════════════════════════════════════════════
  // 3. CRUD
  // ══════════════════════════════════════════════
  const toggleTaskDone = async (id, cur) => { await axios.put(`${baseUrl}/tasks/${id}`, { is_done: !cur }); fetchAllData(); fetchStats(); fetchUserData(); };
  const handleAddTask = async (e) => { e.preventDefault(); if (!newTaskTitle) return; await axios.post(`${baseUrl}/tasks`, { title: newTaskTitle }); setNewTaskTitle(''); fetchAllData(); fetchStats(); };
  const deleteTask = async (id) => { await axios.delete(`${baseUrl}/tasks/${id}`); fetchAllData(); fetchStats(); };
  const handleAddHabit = async (e) => { e.preventDefault(); await axios.post(`${baseUrl}/habits`, { name: newHabitName }); setNewHabitName(''); fetchAllData(); fetchStats(); };
  const checkInHabit = async (id) => { await axios.put(`${baseUrl}/habits/${id}`, { increment: true }); fetchAllData(); fetchStats(); fetchUserData(); };
  const deleteHabit = async (id) => { await axios.delete(`${baseUrl}/habits/${id}`); fetchAllData(); fetchStats(); };
  const handleAddDiary = async (e) => { e.preventDefault(); await axios.post(`${baseUrl}/diaries`, newDiary); setNewDiary({ title: '', content: '', mood: 'Neutral' }); fetchAllData(); fetchStats(); };
  const deleteDiary = async (id) => { await axios.delete(`${baseUrl}/diaries/${id}`); fetchAllData(); fetchStats(); };

  // ══════════════════════════════════════════════
  // 4. POMODORO LOGIC
  // ══════════════════════════════════════════════
  const completeSession = async (currentMode, currentCount) => {
    clearInterval(timerRef.current);
    setIsRunning(false);

    const newCount = currentCount + 1;
    setSessCount(newCount);

    if (currentMode === 'focus') {
      try {
        const res = await axios.post(`${baseUrl}/pomodoro/complete`);
        const { xp_gained, level, experience, leveled_up } = res.data.data;
        setUser(prev => ({ ...prev, level, experience }));
        await Swal.fire({
          title: leveled_up ? '🎉 LEVEL UP!' : '🍅 Sesi Fokus Selesai!',
          html: leveled_up
            ? `<div style="font-size:2.2rem;color:#818cf8;font-weight:900;margin-bottom:6px">Lv.${level}</div><div style="color:#aaa">+${xp_gained} XP • Kamu naik level!</div>`
            : `<div style="color:#818cf8;font-weight:bold;font-size:1.3rem;margin-bottom:4px">+${xp_gained} XP</div><div style="color:#aaa;font-size:0.9rem">Sesi ke-${newCount} selesai. Waktunya istirahat!</div>`,
          background: '#0d0d1a',
          color: '#fff',
          confirmButtonColor: '#818cf8',
          confirmButtonText: 'Lanjut! 💪',
        });
      } catch {
        await Swal.fire({ title: '🍅 Fokus Selesai!', text: `Sesi ke-${newCount} selesai!`, background: '#0d0d1a', color: '#fff', timer: 2500, showConfirmButton: false });
      }
      const next = newCount % 4 === 0 ? 'long' : 'short';
      setPomMode(next); setTimeLeft(MODES[next].duration);
    } else {
      await Swal.fire({ title: '💪 Break Selesai!', text: 'Siap fokus lagi?', background: '#0d0d1a', color: '#fff', timer: 2000, showConfirmButton: false });
      setPomMode('focus'); setTimeLeft(MODES.focus.duration);
    }
  };

  // Ref selalu up-to-date agar interval tidak basi
  completeRef.current = () => completeSession(pomMode, sessCount);

  useEffect(() => {
    if (!isRunning) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setTimeout(() => completeRef.current(), 80); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  useEffect(() => { return () => clearInterval(timerRef.current); }, []);

  const toggleTimer = () => { setIsRunning(prev => !prev); };
  const resetTimer = () => { clearInterval(timerRef.current); setIsRunning(false); setTimeLeft(MODES[pomMode].duration); };
  const changeMode = (m) => { clearInterval(timerRef.current); setIsRunning(false); setPomMode(m); setTimeLeft(MODES[m].duration); };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const pct = timeLeft / MODES[pomMode].duration;
  const offset = CIRC * (1 - pct);
  const curMode = MODES[pomMode];
  const dotAngle = -Math.PI / 2 + (1 - pct) * 2 * Math.PI;
  const dotX = 140 + RADIUS * Math.cos(dotAngle);
  const dotY = 140 + RADIUS * Math.sin(dotAngle);

  // Computed values
  const completedTasks = tasks.filter(t => t.is_done).length;
  const pendingTasks = tasks.filter(t => !t.is_done).length;
  const taskCompletionPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const totalStreak = habits.reduce((a, h) => a + h.streak, 0);
  const userInitials = user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  // ══════════════════════════════════════════════
  // 6. LOGIN PAGE
  // ══════════════════════════════════════════════
  if (!token) {
    return (
      <div className="login-bg">
        {/* Floating orbs */}
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
        <div className="login-orb login-orb-3"></div>

        <div className="login-card">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h1 className="logo-text-large" style={{ marginBottom: '8px' }}>
              Life<span className="logo-gradient">Hub</span>
            </h1>
            <p style={{ color: '#555577', fontSize: '0.9rem', fontWeight: 500 }}>
              Your Productivity Companion
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#555577', fontSize: '0.85rem' }}></i>
              <input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-premium"
                style={{ paddingLeft: '46px' }}
                required
              />
            </div>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-lock" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#555577', fontSize: '0.85rem' }}></i>
              <input
                type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-premium"
                style={{ paddingLeft: '46px' }}
                required
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '16px' }}>
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <i className="fas fa-arrow-right-to-bracket"></i>
                Masuk ke LifeHub
              </span>
            </button>
          </form>

          {/* Decorative bottom */}
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <p style={{ color: '#333355', fontSize: '0.75rem', fontWeight: 500 }}>
              ✨ Kelola hidup, bangun kebiasaan, raih tujuan
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // 7. MAIN APP
  // ══════════════════════════════════════════════
  const TABS = [
    { id: 'dashboard', icon: 'fas fa-th-large', label: 'Dashboard' },
    { id: 'tasks', icon: 'fas fa-check-double', label: 'Tasks' },
    { id: 'habits', icon: 'fas fa-bolt', label: 'Habits' },
    { id: 'diary', icon: 'fas fa-book', label: 'Diary' },
    { id: 'focus', icon: 'fas fa-clock', label: 'Focus Mode' },
    { id: 'analytics', icon: 'fas fa-chart-pie', label: 'Analytics' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#06060e', fontFamily: "'Outfit', sans-serif" }}>

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h1 className="logo-text">
            Life<span className="logo-gradient">Hub</span>
          </h1>
        </div>

        {/* User profile mini */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', borderRadius: '16px',
          background: 'rgba(15, 15, 35, 0.4)',
          border: '1px solid rgba(255,255,255,0.04)',
          marginBottom: '28px'
        }}>
          <div className="user-avatar">{userInitials}</div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ddddf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name || 'Player'}
            </p>
            <p style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 500 }}>
              Level {user.level} Explorer
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); if (t.id === 'analytics') fetchStats(); }}
              className={`nav-btn ${activeTab === t.id ? 'active' : ''}`}
            >
              <i className={`${t.icon}`} style={{ width: '18px', textAlign: 'center', fontSize: '0.85rem' }}></i>
              {t.label}
            </button>
          ))}
        </nav>

        {/* XP / Level */}
        <div className="xp-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666688', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Experience
            </span>
            <span className="level-badge">
              LV {user.level}
            </span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${Math.min(user.experience, 100)}%` }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#444466', fontWeight: 600 }}>{user.experience} XP</span>
            <span style={{ fontSize: '0.7rem', color: '#444466', fontWeight: 600 }}>100 XP</span>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="btn-logout">
          <i className="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <main className="main-content">

        {/* ─────────── DASHBOARD ─────────── */}
        {activeTab === 'dashboard' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* Greeting */}
            <div className="section-header" style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '0.85rem', color: '#555577', fontWeight: 500, marginBottom: '6px' }}>
                {getGreeting()} 👋
              </p>
              <h2 className="section-title" style={{ fontSize: '2.4rem' }}>
                {user.name ? `${user.name.split(' ')[0]}'s Dashboard` : 'Dashboard Overview'}
              </h2>
              <p style={{ color: '#444466', fontSize: '0.85rem', marginTop: '8px', fontWeight: 500 }}>
                Ringkasan aktivitas dan produktivitasmu hari ini
              </p>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Pending Tasks */}
              <div className="glass-card glass-card-purple stat-card">
                <div className="stat-icon" style={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8' }}>
                  <i className="fas fa-list-check"></i>
                </div>
                <div className="stat-number" style={{ color: '#818cf8' }}>{pendingTasks}</div>
                <p className="stat-label" style={{ color: '#555577' }}>Pending Tasks</p>
                {tasks.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${taskCompletionPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '4px', transition: 'width 0.6s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#666688', fontWeight: 700 }}>{taskCompletionPct}%</span>
                  </div>
                )}
              </div>

              {/* Total Streak */}
              <div className="glass-card glass-card-yellow stat-card">
                <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                  <i className="fas fa-fire-flame-curved"></i>
                </div>
                <div className="stat-number" style={{ color: '#fbbf24' }}>
                  {totalStreak}
                  <span style={{ fontSize: '1.5rem', marginLeft: '8px' }}>🔥</span>
                </div>
                <p className="stat-label" style={{ color: '#555577' }}>Total Streak</p>
                <p style={{ fontSize: '0.75rem', color: '#444466', marginTop: '12px', fontWeight: 500 }}>
                  {habits.length} habit aktif
                </p>
              </div>

              {/* Latest Mood */}
              <div className="glass-card glass-card-green stat-card">
                <div className="stat-icon" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' }}>
                  <i className="fas fa-heart-pulse"></i>
                </div>
                <div className="stat-number" style={{ color: '#4ade80', fontSize: '2.2rem' }}>
                  {diaries.length > 0 ? diaries[0].mood : 'No Entry'}
                </div>
                <p className="stat-label" style={{ color: '#555577' }}>Latest Mood</p>
                <p style={{ fontSize: '0.75rem', color: '#444466', marginTop: '12px', fontWeight: 500 }}>
                  {diaries.length} jurnal ditulis
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <button
                onClick={() => setActiveTab('tasks')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.4s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                  <i className="fas fa-plus"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ddddf0' }}>Tambah Task</p>
                  <p style={{ fontSize: '0.75rem', color: '#555577' }}>Buat tugas baru</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('focus')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.5s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
                  <i className="fas fa-clock"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ddddf0' }}>Focus Mode</p>
                  <p style={{ fontSize: '0.75rem', color: '#555577' }}>Mulai sesi Pomodoro</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('diary')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.6s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', flexShrink: 0 }}>
                  <i className="fas fa-pen-fancy"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ddddf0' }}>Tulis Jurnal</p>
                  <p style={{ fontSize: '0.75rem', color: '#555577' }}>Ceritakan harimu</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─────────── TASKS ─────────── */}
        {activeTab === 'tasks' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="section-header">
              <h2 className="section-title">Task Center</h2>
              <p className="section-subtitle">Kelola dan selesaikan tugasmu satu per satu</p>
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="glass-card task-progress" style={{ animationDelay: '0.1s' }}>
                <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - taskCompletionPct / 100)}`}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '22px 22px', transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  <text x="22" y="26" textAnchor="middle" fill="#818cf8" fontSize="11" fontWeight="800">{taskCompletionPct}%</text>
                </svg>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ddddf0' }}>
                    {completedTasks} dari {tasks.length} selesai
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#555577' }}>
                    {pendingTasks === 0 ? '🎉 Semua tugas selesai!' : `${pendingTasks} tugas tersisa`}
                  </p>
                </div>
              </div>
            )}

            {/* Add Task Form */}
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '12px', marginBottom: '28px', animation: 'fadeInUp 0.4s ease-out 0.15s both' }}>
              <input
                type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="✏️ Apa tugasmu hari ini?"
                className="input-premium"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-white" style={{ whiteSpace: 'nowrap' }}>
                <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                Tambah
              </button>
            </form>

            {/* Task List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <p className="empty-state-text">Belum ada tugas. Tambahkan tugas pertamamu!</p>
                </div>
              ) : (
                tasks.map((t, i) => (
                  <div key={t.id} className={`task-item ${t.is_done ? 'done' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', flex: 1 }} onClick={() => toggleTaskDone(t.id, t.is_done)}>
                      <div className={`custom-checkbox ${t.is_done ? 'checked' : ''}`}>
                        {t.is_done && <i className="fas fa-check" style={{ fontSize: '10px', color: 'white' }}></i>}
                      </div>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: t.is_done ? '#444466' : '#ddddf0',
                        textDecoration: t.is_done ? 'line-through' : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                        {t.title}
                      </span>
                    </div>
                    <button onClick={() => deleteTask(t.id)} className="btn-delete">
                      <i className="fas fa-trash" style={{ fontSize: '0.8rem' }}></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─────────── HABITS ─────────── */}
        {activeTab === 'habits' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="section-header">
              <h2 className="section-title">Habit Forge</h2>
              <p className="section-subtitle">Bangun kebiasaan positif, raih streak terpanjang</p>
            </div>

            {/* Add Habit Form */}
            <form onSubmit={handleAddHabit} style={{ display: 'flex', gap: '12px', marginTop: '24px', marginBottom: '28px', animation: 'fadeInUp 0.4s ease-out 0.1s both' }}>
              <input
                type="text" value={newHabitName} onChange={e => setNewHabitName(e.target.value)}
                placeholder="⚡ Buat habit baru..."
                className="input-premium input-premium-yellow"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-yellow" style={{ whiteSpace: 'nowrap' }}>
                <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                Buat
              </button>
            </form>

            {/* Habit Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {habits.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty-state-icon">⚡</div>
                  <p className="empty-state-text">Belum ada habit. Mulai bangun kebiasaan baikmu!</p>
                </div>
              ) : (
                habits.map((h, i) => {
                  const tier = getStreakTier(h.streak);
                  return (
                    <div key={h.id} className="glass-card glass-card-yellow habit-card" style={{ animationDelay: `${i * 0.08}s` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f0f0f5', marginBottom: '8px' }}>{h.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>{tier.icon}</span>
                            <span className={tier.class} style={{ fontWeight: 800, fontSize: '1.4rem' }}>{h.streak}</span>
                            <span style={{ fontSize: '0.8rem', color: '#555577', fontWeight: 600 }}>hari streak</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => checkInHabit(h.id)} className="habit-checkin-btn">
                            🔥
                          </button>
                          <button onClick={() => deleteHabit(h.id)} className="btn-delete">
                            <i className="fas fa-trash" style={{ fontSize: '0.8rem' }}></i>
                          </button>
                        </div>
                      </div>
                      {/* Mini streak bar */}
                      <div style={{ marginTop: '16px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(h.streak / 30 * 100, 100)}%`,
                          height: '100%',
                          background: h.streak >= 30 ? 'linear-gradient(90deg, #f59e0b, #fcd34d)' : h.streak >= 7 ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' : 'linear-gradient(90deg, #a78242, #cd9b5a)',
                          borderRadius: '3px',
                          transition: 'width 0.6s ease'
                        }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─────────── DIARY ─────────── */}
        {activeTab === 'diary' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="section-header" style={{ marginBottom: '28px' }}>
              <h2 className="section-title">My Journal</h2>
              <p className="section-subtitle">Tulis pikiran, perasaan, dan refleksimu</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '28px' }}>
              {/* Write Form */}
              <div className="glass-card" style={{ padding: '28px', height: 'fit-content', position: 'sticky', top: '0', animation: 'fadeInUp 0.4s ease-out both' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f0f0f5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-pen-fancy" style={{ color: '#818cf8', fontSize: '0.9rem' }}></i>
                  Tulis Jurnal Baru
                </h3>
                <form onSubmit={handleAddDiary} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <input
                    type="text" placeholder="Judul..." value={newDiary.title}
                    onChange={e => setNewDiary({ ...newDiary, title: e.target.value })}
                    className="input-premium"
                  />
                  <select
                    value={newDiary.mood}
                    onChange={e => setNewDiary({ ...newDiary, mood: e.target.value })}
                    className="select-premium"
                  >
                    <option value="Happy">😁 Happy</option>
                    <option value="Neutral">😐 Neutral</option>
                    <option value="Sad">😢 Sad</option>
                    <option value="On Fire">🔥 On Fire</option>
                  </select>
                  <textarea
                    placeholder="Ceritakan harimu..."
                    value={newDiary.content}
                    onChange={e => setNewDiary({ ...newDiary, content: e.target.value })}
                    className="textarea-premium"
                  ></textarea>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <i className="fas fa-paper-plane"></i>
                      Simpan Jurnal
                    </span>
                  </button>
                </form>
              </div>

              {/* Diary Entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {diaries.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📖</div>
                    <p className="empty-state-text">Belum ada jurnal. Tulis ceritamu hari ini!</p>
                  </div>
                ) : (
                  diaries.map((d, i) => {
                    const moodClass = d.mood === 'On Fire' ? 'mood-OnFire' : `mood-${d.mood}`;
                    return (
                      <div key={d.id} className="glass-card diary-entry" style={{ animationDelay: `${i * 0.08}s` }}>
                        <button onClick={() => deleteDiary(d.id)} className="btn-close">
                          <i className="fas fa-times" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingRight: '36px' }}>
                          <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: '#f0f0f5' }}>{d.title}</h3>
                          <span className={`mood-badge ${moodClass}`}>{d.mood}</span>
                        </div>
                        <p style={{ color: '#9999bb', lineHeight: 1.7, whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{d.content}</p>
                        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <p style={{ fontSize: '0.75rem', color: '#444466', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fas fa-calendar" style={{ fontSize: '0.65rem' }}></i>
                            {new Date(d.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────── FOCUS MODE — POMODORO TIMER ─────────── */}
        {activeTab === 'focus' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '82vh', userSelect: 'none', position: 'relative', zIndex: 1 }}>

            {/* Ambient background glow */}
            <div style={{
              position: 'absolute',
              width: '500px', height: '500px',
              borderRadius: '50%',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${curMode.color}08, transparent 70%)`,
              filter: 'blur(60px)',
              pointerEvents: 'none',
              transition: 'background 0.6s ease',
              animation: isRunning ? 'breathe 4s ease-in-out infinite' : 'none',
            }}></div>

            <div className="section-header" style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h2 className="section-title">⏱ Focus Mode</h2>
              <p className="section-subtitle">
                Selesaikan sesi fokus 25 menit → <span style={{ color: curMode.color, fontWeight: 700 }}>+25 XP</span> otomatis
              </p>
            </div>

            {/* Mode Selector */}
            <div style={{
              display: 'flex', gap: '6px',
              marginBottom: '40px', marginTop: '16px',
              padding: '6px',
              borderRadius: '16px',
              background: 'rgba(12, 12, 28, 0.5)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              {Object.entries(MODES).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => changeMode(key)}
                  className="focus-mode-tab"
                  style={pomMode === key
                    ? { background: val.color + '15', color: val.color, borderColor: val.color + '30', boxShadow: `0 0 16px ${val.color}10` }
                    : { color: '#555577' }}
                >
                  {val.label}
                </button>
              ))}
            </div>

            {/* Circular SVG Timer */}
            <div style={{
              position: 'relative', marginBottom: '40px',
              filter: isRunning ? `drop-shadow(0 0 30px ${curMode.shadow})` : 'drop-shadow(0 0 0px transparent)',
              transition: 'filter 0.6s ease',
            }}>
              <svg width="280" height="280" viewBox="0 0 280 280">
                {/* Outer subtle ring */}
                <circle cx="140" cy="140" r={RADIUS + 14} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                {/* Track ring */}
                <circle cx="140" cy="140" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                {/* Progress ring */}
                <circle cx="140" cy="140" r={RADIUS} fill="none"
                  stroke={curMode.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={offset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '140px 140px', transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                />
                {/* Glow ring behind progress */}
                <circle cx="140" cy="140" r={RADIUS} fill="none"
                  stroke={curMode.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={offset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '140px 140px', transition: 'stroke-dashoffset 1s linear, stroke 0.4s', filter: `blur(8px)`, opacity: 0.3 }}
                />
                {/* Dot at tip */}
                {pct < 1 && (
                  <circle cx={dotX} cy={dotY} r="6" fill={curMode.color}
                    style={{ filter: `drop-shadow(0 0 8px ${curMode.color})` }} />
                )}
                {/* Time display */}
                <text x="140" y="124" textAnchor="middle" fill="white" fontSize="42" fontWeight="900" fontFamily="'JetBrains Mono', 'Courier New', monospace">{fmt(timeLeft)}</text>
                <text x="140" y="152" textAnchor="middle" fill={curMode.color} fontSize="11" fontWeight="700" letterSpacing="3">{curMode.label.toUpperCase()}</text>
                <text x="140" y="174" textAnchor="middle" fill="#444466" fontSize="11" fontWeight="600">Sesi #{sessCount + 1}</text>
              </svg>

              {/* Pulse rings when running */}
              {isRunning && (
                <>
                  <div style={{
                    position: 'absolute', inset: '-10px', borderRadius: '50%',
                    border: `2px solid ${curMode.color}`,
                    animation: 'ring-pulse 2s ease-out infinite',
                    pointerEvents: 'none',
                  }}></div>
                  <div style={{
                    position: 'absolute', inset: '-10px', borderRadius: '50%',
                    border: `2px solid ${curMode.color}`,
                    animation: 'ring-pulse 2s ease-out 0.7s infinite',
                    pointerEvents: 'none',
                  }}></div>
                </>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
              <button onClick={resetTimer} className="focus-control-btn">
                <i className="fas fa-redo" style={{ fontSize: '0.85rem' }}></i>
              </button>

              <button
                onClick={toggleTimer}
                className="focus-play-btn"
                style={{
                  background: isRunning ? `${curMode.color}12` : curMode.color,
                  borderColor: curMode.color,
                  color: isRunning ? curMode.color : '#000',
                  boxShadow: isRunning ? `0 0 30px ${curMode.shadow}` : `0 4px 24px ${curMode.shadow}`,
                }}
              >
                <i className={`fas ${isRunning ? 'fa-pause' : 'fa-play'} ${!isRunning ? 'ml-1' : ''}`}></i>
              </button>

              <div className="focus-control-btn" style={{ cursor: 'default' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{Math.round((1 - pct) * 100)}%</span>
              </div>
            </div>

            {/* Session dots */}
            {sessCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.4s ease' }}>
                <span style={{ fontSize: '0.7rem', color: '#444466', fontWeight: 700, marginRight: '4px' }}>Sesi selesai:</span>
                {Array.from({ length: Math.min(sessCount, 8) }).map((_, i) => (
                  <div key={i} className="session-dot"
                    style={{
                      background: MODES.focus.color,
                      boxShadow: `0 0 8px ${MODES.focus.shadow}`,
                      animationDelay: `${i * 0.08}s`
                    }}
                  />
                ))}
                {sessCount > 8 && <span style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 700 }}>+{sessCount - 8}</span>}
              </div>
            )}
          </div>
        )}

        {/* ─────────── ANALYTICS ─────────── */}
        {activeTab === 'analytics' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="section-header" style={{ marginBottom: '32px' }}>
              <h2 className="section-title">Productivity Insights</h2>
              <p className="section-subtitle">Pantau perkembangan dan produktivitasmu</p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.05s both' }}>
                <p style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Tasks</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#818cf8', marginTop: '4px' }}>{tasks.length}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.1s both' }}>
                <p style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Completed</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>{completedTasks}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.15s both' }}>
                <p style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Habits</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>{habits.length}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.2s both' }}>
                <p style={{ fontSize: '0.7rem', color: '#555577', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Journal</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#60a5fa', marginTop: '4px' }}>{diaries.length}</p>
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass-card chart-card" style={{ animationDelay: '0.15s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 8px rgba(129,140,248,0.4)' }}></span>
                  <span style={{ color: '#ddddf0' }}>Penyelesaian Tugas</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.tasks} innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                        <Cell fill="#818cf8" />
                        <Cell fill="rgba(255,255,255,0.06)" />
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
                      <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card chart-card" style={{ animationDelay: '0.25s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }}></span>
                  <span style={{ color: '#ddddf0' }}>Performa Habit (Streak)</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.habits}>
                      <XAxis dataKey="name" stroke="#444466" fontSize={11} fontFamily="Outfit" />
                      <YAxis stroke="#444466" fontSize={11} fontFamily="Outfit" />
                      <Tooltip cursor={{ fill: 'rgba(129,140,248,0.04)' }} contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
                      <Bar dataKey="value" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card chart-card" style={{ gridColumn: '1 / -1', animationDelay: '0.35s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.4)' }}></span>
                  <span style={{ color: '#ddddf0' }}>Analisis Suasana Hati</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.moods} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#ddddf0" fontSize={12} fontFamily="Outfit" width={80} />
                      <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
                      <Bar dataKey="value" fill="#4ade80" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;