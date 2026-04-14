import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  const timerRef    = useRef(null);
  const completeRef = useRef(null);  // selalu up-to-date tanpa dep loop

  const baseUrl = 'http://127.0.0.1:8000/api';
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
      Swal.fire({ icon: 'success', title: 'Berhasil Masuk!', background: '#111', color: '#fff', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'Email atau password salah.', background: '#111', color: '#fff' });
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
          background: '#0a0a0a',
          color: '#fff',
          confirmButtonColor: '#818cf8',
          confirmButtonText: 'Lanjut! 💪',
        });
      } catch {
        await Swal.fire({ title: '🍅 Fokus Selesai!', text: `Sesi ke-${newCount} selesai!`, background: '#0a0a0a', color: '#fff', timer: 2500, showConfirmButton: false });
      }
      const next = newCount % 4 === 0 ? 'long' : 'short';
      setPomMode(next); setTimeLeft(MODES[next].duration);
    } else {
      await Swal.fire({ title: '💪 Break Selesai!', text: 'Siap fokus lagi?', background: '#0a0a0a', color: '#fff', timer: 2000, showConfirmButton: false });
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
  const resetTimer  = () => { clearInterval(timerRef.current); setIsRunning(false); setTimeLeft(MODES[pomMode].duration); };
  const changeMode  = (m) => { clearInterval(timerRef.current); setIsRunning(false); setPomMode(m); setTimeLeft(MODES[m].duration); };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const pct = timeLeft / MODES[pomMode].duration;
  const offset = CIRC * (1 - pct);
  const cur = MODES[pomMode];
  const dotAngle = -Math.PI / 2 + (1 - pct) * 2 * Math.PI;
  const dotX = 140 + RADIUS * Math.cos(dotAngle);
  const dotY = 140 + RADIUS * Math.sin(dotAngle);

  // ══════════════════════════════════════════════
  // 6. LOGIN PAGE
  // ══════════════════════════════════════════════
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="w-full max-w-md bg-[#111] p-8 rounded-3xl border border-gray-800 shadow-2xl">
          <h1 className="text-3xl font-extrabold text-center mb-6">Life<span className="text-indigo-400">Hub</span></h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl border border-gray-700 outline-none" required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl border border-gray-700 outline-none" required />
            <button className="w-full bg-indigo-500 font-bold py-4 rounded-xl hover:bg-indigo-600 transition">Login</button>
          </form>
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
    { id: 'focus', icon: 'fas fa-clock', label: '⏱ Focus Mode' },
    { id: 'analytics', icon: 'fas fa-chart-pie', label: 'Analytics' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-['Plus_Jakarta_Sans'] overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className="w-72 bg-[#111] border-r border-gray-800 flex flex-col p-6 shrink-0">
        <h1 className="text-2xl font-extrabold mb-10 text-center">Life<span className="text-indigo-400">Hub</span></h1>

        <nav className="flex-1 space-y-1">
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => { setActiveTab(t.id); if (t.id === 'analytics') fetchStats(); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold capitalize transition-all flex items-center gap-3
                ${activeTab === t.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:bg-[#1a1a1a]'}`}>
              <i className={`${t.icon} w-5 text-center text-sm`}></i>
              {t.label}
            </button>
          ))}
        </nav>

        {/* Level & XP */}
        <div className="mb-5 p-4 bg-[#1a1a1a] rounded-2xl border border-gray-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">Player Level</span>
            <span className="text-xs font-black text-white bg-indigo-500 px-2 py-0.5 rounded">LV {user.level}</span>
          </div>
          <div className="w-full bg-[#0a0a0a] h-2 rounded-full overflow-hidden border border-gray-800">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              style={{ width: `${Math.min(user.experience, 100)}%` }}></div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-gray-500 font-bold">{user.experience} XP</span>
            <span className="text-[10px] text-gray-500 font-bold">100 XP</span>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full p-3 bg-red-500/10 text-red-400 rounded-xl font-bold hover:bg-red-500/20 transition">
          <i className="fas fa-sign-out-alt mr-2"></i>Logout
        </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto p-10">

        {/* ─ DASHBOARD ─ */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-extrabold mb-8">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#111] p-8 rounded-3xl border border-gray-800"><p className="text-gray-500 text-xs font-bold uppercase">Pending Tasks</p><h3 className="text-6xl font-black mt-4">{tasks.filter(t => !t.is_done).length}</h3></div>
              <div className="bg-[#111] p-8 rounded-3xl border border-gray-800"><p className="text-gray-500 text-xs font-bold uppercase">Total Streak</p><h3 className="text-6xl font-black text-yellow-500 mt-4">{habits.reduce((a, h) => a + h.streak, 0)} <i className="fas fa-fire text-3xl"></i></h3></div>
              <div className="bg-[#111] p-8 rounded-3xl border border-gray-800"><p className="text-gray-500 text-xs font-bold uppercase">Latest Mood</p><h3 className="text-4xl font-black text-green-400 mt-4 capitalize">{diaries.length > 0 ? diaries[0].mood : 'No Entry'}</h3></div>
            </div>
          </div>
        )}

        {/* ─ TASKS ─ */}
        {activeTab === 'tasks' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold mb-6">Task Center</h2>
            <form onSubmit={handleAddTask} className="flex gap-4 mb-8">
              <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Apa tugasmu hari ini?" className="flex-1 bg-[#111] px-6 py-4 rounded-xl border border-gray-700 outline-none focus:border-indigo-500" />
              <button className="px-8 bg-white text-black font-bold rounded-xl">Tambah</button>
            </form>
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} className={`p-4 flex items-center justify-between rounded-xl border transition-all ${t.is_done ? 'bg-[#111] border-gray-800 opacity-50' : 'bg-[#1a1a1a] border-gray-700 shadow-lg'}`}>
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleTaskDone(t.id, t.is_done)}>
                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${t.is_done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'}`}><i className="fas fa-check text-[10px] text-black"></i></div>
                    <span className={`font-bold ${t.is_done ? 'line-through text-gray-500' : 'text-gray-200'}`}>{t.title}</span>
                  </div>
                  <button onClick={() => deleteTask(t.id)} className="text-red-400 p-2 hover:scale-125 transition-transform"><i className="fas fa-trash"></i></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─ HABITS ─ */}
        {activeTab === 'habits' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-extrabold mb-6">Habit Forge</h2>
            <form onSubmit={handleAddHabit} className="flex gap-4 mb-8">
              <input type="text" value={newHabitName} onChange={e => setNewHabitName(e.target.value)} placeholder="Buat habit baru..." className="flex-1 bg-[#111] px-6 py-4 rounded-xl border border-gray-700 outline-none focus:border-yellow-500" />
              <button className="px-8 bg-yellow-500 text-black font-bold rounded-xl">Buat</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {habits.map(h => (
                <div key={h.id} className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-700 flex justify-between items-center">
                  <div><h3 className="text-xl font-bold">{h.name}</h3><p className="text-gray-400 text-sm">Streak: <span className="text-yellow-500 font-bold">{h.streak} Hari</span></p></div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => checkInHabit(h.id)} className="w-12 h-12 bg-[#111] border border-gray-600 rounded-full flex items-center justify-center hover:bg-yellow-500 hover:text-black transition">🔥</button>
                    <button onClick={() => deleteHabit(h.id)} className="text-red-400 p-2"><i className="fas fa-trash"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─ DIARY ─ */}
        {activeTab === 'diary' && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-[#111] p-6 rounded-3xl border border-gray-800 h-fit">
              <h3 className="font-bold text-xl mb-4">Tulis Jurnal Baru</h3>
              <form onSubmit={handleAddDiary} className="space-y-4">
                <input type="text" placeholder="Judul..." value={newDiary.title} onChange={e => setNewDiary({ ...newDiary, title: e.target.value })} className="w-full bg-[#1a1a1a] p-3 rounded-lg border border-gray-700 outline-none focus:border-indigo-500" />
                <select value={newDiary.mood} onChange={e => setNewDiary({ ...newDiary, mood: e.target.value })} className="w-full bg-[#1a1a1a] p-3 rounded-lg border border-gray-700 text-gray-300 outline-none">
                  <option value="Happy">😁 Happy</option><option value="Neutral">😐 Neutral</option><option value="Sad">😢 Sad</option><option value="On Fire">🔥 On Fire</option>
                </select>
                <textarea placeholder="Ceritakan harimu..." value={newDiary.content} onChange={e => setNewDiary({ ...newDiary, content: e.target.value })} className="w-full h-32 bg-[#1a1a1a] p-3 rounded-lg border border-gray-700 outline-none focus:border-indigo-500 resize-none"></textarea>
                <button className="w-full bg-indigo-500 text-white font-bold py-3 rounded-lg hover:bg-indigo-600 transition">Simpan</button>
              </form>
            </div>
            <div className="lg:col-span-2 space-y-4">
              {diaries.map(d => (
                <div key={d.id} className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-700 relative">
                  <button onClick={() => deleteDiary(d.id)} className="absolute top-4 right-4 text-gray-600 hover:text-red-500"><i className="fas fa-times"></i></button>
                  <div className="flex justify-between items-end mb-4"><h3 className="text-2xl font-bold">{d.title}</h3><span className="text-xs bg-[#111] px-3 py-1 rounded-full border border-gray-600">{d.mood}</span></div>
                  <p className="text-gray-300 whitespace-pre-line">{d.content}</p>
                  <p className="text-xs text-gray-500 mt-4">{new Date(d.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            ⏱ FOCUS MODE — POMODORO TIMER
        ───────────────────────────────────────────── */}
        {activeTab === 'focus' && (
          <div className="flex flex-col items-center justify-center min-h-[82vh] select-none">

            <h2 className="text-3xl font-extrabold mb-1 text-center">⏱ Focus Mode</h2>
            <p className="text-gray-500 text-sm mb-8 text-center">Selesaikan sesi fokus 25 menit → <span style={{ color: cur.color }}>+25 XP</span> otomatis</p>

            {/* Mode Selector */}
            <div className="flex gap-2 mb-10 bg-[#111] p-1.5 rounded-2xl border border-gray-800">
              {Object.entries(MODES).map(([key, val]) => (
                <button key={key} onClick={() => changeMode(key)}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                  style={pomMode === key
                    ? { background: val.color + '20', color: val.color, border: `1px solid ${val.color}50` }
                    : { color: '#6b7280', border: '1px solid transparent' }}>
                  {val.label}
                </button>
              ))}
            </div>

            {/* Circular SVG Timer */}
            <div className="relative mb-10"
              style={{
                filter: isRunning ? `drop-shadow(0 0 25px ${cur.shadow})` : 'drop-shadow(0 0 0px transparent)',
                transition: 'filter 0.6s ease',
              }}>
              <svg width="280" height="280" viewBox="0 0 280 280">
                {/* Track ring */}
                <circle cx="140" cy="140" r={RADIUS} fill="none" stroke="#1e1e1e" strokeWidth="14" />
                {/* Progress ring */}
                <circle cx="140" cy="140" r={RADIUS} fill="none"
                  stroke={cur.color} strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={offset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '140px 140px', transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }} />
                {/* Dot at tip */}
                {pct < 1 && (
                  <circle cx={dotX} cy={dotY} r="7" fill={cur.color}
                    style={{ filter: `drop-shadow(0 0 6px ${cur.color})` }} />
                )}
                {/* Time display */}
                <text x="140" y="126" textAnchor="middle" fill="white" fontSize="44" fontWeight="900" fontFamily="'Courier New', monospace">{fmt(timeLeft)}</text>
                <text x="140" y="154" textAnchor="middle" fill={cur.color} fontSize="12" fontWeight="800" letterSpacing="3">{cur.label.toUpperCase()}</text>
                <text x="140" y="175" textAnchor="middle" fill="#444" fontSize="11">Sesi #{sessCount + 1}</text>
              </svg>

              {/* Pulse rings when running */}
              {isRunning && <>
                <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-10" style={{ borderColor: cur.color }}></div>
              </>}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-5 mb-10">
              {/* Reset */}
              <button onClick={resetTimer}
                className="w-12 h-12 rounded-full bg-[#111] border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 transition flex items-center justify-center">
                <i className="fas fa-redo text-sm"></i>
              </button>

              {/* Play / Pause */}
              <button onClick={toggleTimer}
                className="w-20 h-20 rounded-full font-black text-xl transition-all duration-300 flex items-center justify-center"
                style={{
                  background: isRunning ? `${cur.color}18` : cur.color,
                  border: `2px solid ${cur.color}`,
                  color: isRunning ? cur.color : '#000',
                  boxShadow: isRunning ? `0 0 24px ${cur.shadow}` : `0 4px 20px ${cur.shadow}`,
                }}>
                <i className={`fas ${isRunning ? 'fa-pause' : 'fa-play'} ${!isRunning ? 'ml-1' : ''}`}></i>
              </button>

              {/* Percent badge */}
              <div className="w-12 h-12 rounded-full bg-[#111] border border-gray-700 flex items-center justify-center">
                <span className="text-[10px] text-gray-400 font-bold">{Math.round((1 - pct) * 100)}%</span>
              </div>
            </div>


            {/* Session dots (completed focus sessions this run) */}
            {sessCount > 0 && (
              <div className="mt-6 flex gap-2 items-center">
                <span className="text-[10px] text-gray-600 font-bold mr-1">Sesi selesai:</span>
                {Array.from({ length: Math.min(sessCount, 8) }).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full"
                    style={{ background: MODES.focus.color, boxShadow: `0 0 6px ${MODES.focus.shadow}` }} />
                ))}
                {sessCount > 8 && <span className="text-[10px] text-gray-600 font-bold">+{sessCount - 8}</span>}
              </div>
            )}
          </div>
        )}

        {/* ─ ANALYTICS ─ */}
        {activeTab === 'analytics' && (
          <div className="max-w-6xl mx-auto space-y-10">
            <h2 className="text-3xl font-extrabold mb-8">Productivity Insights</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#111] p-6 rounded-3xl border border-gray-800">
                <h3 className="text-xl font-bold mb-6 text-indigo-400">Penyelesaian Tugas</h3>
                <div className="h-64"><ResponsiveContainer><PieChart><Pie data={stats.tasks} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"><Cell fill="#818cf8" /><Cell fill="#333" /></Pie><Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} /><Legend /></PieChart></ResponsiveContainer></div>
              </div>
              <div className="bg-[#111] p-6 rounded-3xl border border-gray-800">
                <h3 className="text-xl font-bold mb-6 text-yellow-500">Performa Habit (Streak)</h3>
                <div className="h-64"><ResponsiveContainer><BarChart data={stats.habits}><XAxis dataKey="name" stroke="#555" fontSize={12} /><YAxis stroke="#555" fontSize={12} /><Tooltip cursor={{ fill: '#1a1a1a' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} /><Bar dataKey="value" fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="bg-[#111] p-6 rounded-3xl border border-gray-800 lg:col-span-2">
                <h3 className="text-xl font-bold mb-6 text-green-400">Analisis Suasana Hati</h3>
                <div className="h-64"><ResponsiveContainer><BarChart data={stats.moods} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" stroke="#fff" fontSize={12} width={80} /><Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} /><Bar dataKey="value" fill="#4ade80" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;