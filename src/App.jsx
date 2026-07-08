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

// ─── Calendar color options ───
const EVENT_COLORS = [
  '#818cf8', '#60a5fa', '#4ade80', '#fbbf24', '#f87171',
  '#a78bfa', '#2dd4bf', '#fb923c', '#f472b6', '#94a3b8',
];

// ─── Day names ───
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// ─── Motivational Quotes ───
const QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Produktivitas bukan tentang melakukan lebih banyak, tapi melakukan yang benar.', author: 'Tim Ferriss' },
  { text: "It always seems impossible until it's done.", author: 'Nelson Mandela' },
  { text: 'Satu langkah kecil hari ini, seribu langkah besok.', author: 'Pepatah' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Kebiasaan adalah apa yang kamu lakukan saat tidak ada yang melihat.', author: 'Unknown' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Disiplin adalah jembatan antara tujuan dan pencapaian.', author: 'Jim Rohn' },
  { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
  { text: 'Konsistensi kecil mengalahkan usaha besar yang sesekali.', author: 'Unknown' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
  { text: 'Jangan tunda apa yang bisa kamu mulai hari ini.', author: 'Benjamin Franklin' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Unknown' },
  { text: 'Waktu adalah sumber daya paling berharga yang kamu miliki.', author: 'Unknown' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Sukses adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.', author: 'Colin Powell' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Mulailah dari mana kamu berada. Gunakan apa yang kamu punya. Lakukan apa yang kamu bisa.', author: 'Arthur Ashe' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Setiap ahli pernah menjadi pemula.', author: 'Helen Hayes' },
  { text: 'Progress, not perfection.', author: 'Unknown' },
  { text: 'Bangun pagi, kerja keras, dan bersyukur. Itu resep suksesnya.', author: 'Unknown' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'Kamu lebih kuat dari yang kamu kira.', author: 'Unknown' },
  { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
  { text: 'Jangan bandingkan perjalananmu dengan orang lain. Fokus pada prosesmu.', author: 'Unknown' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Hari ini sulit, besok lebih sulit, lusa akan indah.', author: 'Jack Ma' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Satu hal terpenting: jangan pernah berhenti belajar.', author: 'Unknown' },
];

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

// ─── Helper: Get daily quote ───
const getDailyQuote = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
};

// ─── Helper: Format date string YYYY-MM-DD ───
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Helper: Google Calendar URL ───
const generateGoogleCalendarUrl = (event) => {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(event.description || '');

  // Build date/time strings
  const dateClean = event.date.replace(/-/g, '');
  let dates;
  if (event.startTime && event.endTime) {
    const start = `${dateClean}T${event.startTime.replace(/:/g, '')}00`;
    const end = `${dateClean}T${event.endTime.replace(/:/g, '')}00`;
    dates = `${start}/${end}`;
  } else {
    // All day event
    dates = `${dateClean}/${dateClean}`;
  }

  return `${base}&text=${title}&dates=${dates}&details=${details}`;
};

// ─── Calendar helpers ───
const getCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  // Monday = 0 .. Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [];

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const d = new Date(year, month - 1, day);
    days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: true });
  }

  // Next month fill (to make 42 cells = 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
  }

  return days;
};


function App() {
  // ══════════════════════════════════════════════
  // 1. STATE GLOBAL
  // ══════════════════════════════════════════════
  const [theme, setTheme] = useState(() => localStorage.getItem('lifehub_theme') || 'dark');
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

  // ── Calendar State ──
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [calendarEvents, setCalendarEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lifehub_calendar_events') || '[]'); } catch { return []; }
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '', description: '', color: '#818cf8' });

  // ── Quick Notes State ──
  const [quickNote, setQuickNote] = useState(() => localStorage.getItem('lifehub_quick_note') || '');
  const [noteSaved, setNoteSaved] = useState(false);

  // ── Google Calendar API State ──
  const [googleToken, setGoogleToken] = useState(null);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    const initGoogleClient = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PASTE_CLIENT_ID_DI_SINI',
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setGoogleToken(tokenResponse.access_token);
              Swal.fire({ icon: 'success', title: 'Terhubung ke Google Calendar!', background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 1500, showConfirmButton: false });
            }
          },
        });
      } else {
        setTimeout(initGoogleClient, 500);
      }
    };
    initGoogleClient();
  }, []);

  const handleConnectGoogle = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    } else {
      Swal.fire({ icon: 'error', title: 'Oops', text: 'Google API belum termuat. Coba refresh halaman.', background: 'var(--bg-secondary)', color: 'var(--text-primary)' });
    }
  };

  const timerRef = useRef(null);
  const completeRef = useRef(null);
  const noteTimeoutRef = useRef(null);

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
      Swal.fire({ icon: 'success', title: 'Berhasil Masuk!', background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'Email atau password salah.', background: 'var(--bg-secondary)', color: 'var(--text-primary)' });
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
  // 3b. CALENDAR CRUD (localStorage)
  // ══════════════════════════════════════════════
  const saveCalendarEvents = (events) => {
    setCalendarEvents(events);
    localStorage.setItem('lifehub_calendar_events', JSON.stringify(events));
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !selectedDate) return;
    
    const event = {
      id: Date.now(),
      title: newEvent.title,
      date: selectedDate,
      startTime: newEvent.startTime || '',
      endTime: newEvent.endTime || '',
      description: newEvent.description || '',
      color: newEvent.color,
    };

    if (googleToken) {
      Swal.fire({ title: 'Menyimpan ke Google Calendar...', background: 'var(--bg-secondary)', color: 'var(--text-primary)', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const gEvent = {
        summary: event.title,
        description: event.description,
      };

      if (event.startTime && event.endTime) {
        gEvent.start = { dateTime: `${selectedDate}T${event.startTime}:00+07:00`, timeZone: 'Asia/Jakarta' };
        gEvent.end = { dateTime: `${selectedDate}T${event.endTime}:00+07:00`, timeZone: 'Asia/Jakarta' };
      } else {
        gEvent.start = { date: selectedDate };
        gEvent.end = { date: selectedDate };
      }

      try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(gEvent)
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error('Google API Error:', errData);
          Swal.fire({ icon: 'error', title: 'Gagal API', text: errData.error?.message || 'Pastikan Google Calendar API sudah di-enable di Cloud Console.', background: 'var(--bg-secondary)', color: 'var(--text-primary)' });
          return;
        }
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal Koneksi', text: 'Tidak dapat menghubungi server Google.', background: 'var(--bg-secondary)', color: 'var(--text-primary)' });
        return;
      }
    }

    saveCalendarEvents([...calendarEvents, event]);
    setNewEvent({ title: '', startTime: '', endTime: '', description: '', color: '#818cf8' });
    setShowAddEventForm(false);
    
    if (googleToken) {
      Swal.fire({ icon: 'success', title: 'Tersimpan Otomatis!', text: 'Sudah ditambahkan ke Google Calendar', background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 1800, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'success', title: 'Tersimpan (Lokal)!', text: 'Gunakan tombol Connect untuk auto-save.', background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 1500, showConfirmButton: false });
    }
  };

  const deleteEvent = (id) => {
    saveCalendarEvents(calendarEvents.filter(e => e.id !== id));
  };

  // ── Quick Notes handler ──
  const handleNoteChange = (val) => {
    setQuickNote(val);
    setNoteSaved(false);
    clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('lifehub_quick_note', val);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }, 600);
  };

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
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          confirmButtonColor: '#818cf8',
          confirmButtonText: 'Lanjut! 💪',
        });
      } catch {
        await Swal.fire({ title: '🍅 Fokus Selesai!', text: `Sesi ke-${newCount} selesai!`, background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 2500, showConfirmButton: false });
      }
      const next = newCount % 4 === 0 ? 'long' : 'short';
      setPomMode(next); setTimeLeft(MODES[next].duration);
    } else {
      await Swal.fire({ title: '💪 Break Selesai!', text: 'Siap fokus lagi?', background: 'var(--bg-secondary)', color: 'var(--text-primary)', timer: 2000, showConfirmButton: false });
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

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('lifehub_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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

  // Calendar computed
  const calDays = getCalendarDays(currentMonth.year, currentMonth.month);
  const todayStr = toDateStr(new Date());
  const dailyQuote = getDailyQuote();

  // Events grouped by date for quick lookup
  const eventsByDate = {};
  calendarEvents.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });
  // Tasks by created_at date
  const tasksByDate = {};
  tasks.forEach(t => {
    if (t.created_at) {
      const d = t.created_at.split('T')[0];
      if (!tasksByDate[d]) tasksByDate[d] = [];
      tasksByDate[d].push(t);
    }
  });
  // Diaries by created_at date
  const diariesByDate = {};
  diaries.forEach(d => {
    if (d.created_at) {
      const ds = d.created_at.split('T')[0];
      if (!diariesByDate[ds]) diariesByDate[ds] = [];
      diariesByDate[ds].push(d);
    }
  });

  // Events for selected date
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];
  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];
  const selectedDiaries = selectedDate ? (diariesByDate[selectedDate] || []) : [];

  const prevMonth = () => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
              Your Productivity Companion
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-envelope" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="input-premium" style={{ paddingLeft: '46px' }} required />
            </div>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-lock" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="input-premium" style={{ paddingLeft: '46px' }} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '16px' }}>
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <i className="fas fa-arrow-right-to-bracket"></i>
                Masuk ke LifeHub
              </span>
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
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
    { id: 'calendar', icon: 'fas fa-calendar-days', label: 'Calendar' },
    { id: 'tasks', icon: 'fas fa-check-double', label: 'Tasks' },
    { id: 'habits', icon: 'fas fa-bolt', label: 'Habits' },
    { id: 'diary', icon: 'fas fa-book', label: 'Diary' },
    { id: 'focus', icon: 'fas fa-clock', label: 'Focus Mode' },
    { id: 'analytics', icon: 'fas fa-chart-pie', label: 'Analytics' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Outfit', sans-serif" }}>

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
          background: 'var(--glass-bg)',
          border: '1px solid rgba(255,255,255,0.04)',
          marginBottom: '28px'
        }}>
          <div className="user-avatar">{userInitials}</div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name || 'Player'}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
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
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>
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
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{user.experience} XP</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>100 XP</span>
          </div>
        </div>

        {/* Theme Toggle & Logout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={toggleTheme} 
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', 
              border: '1px solid rgba(255, 255, 255, 0.05)', 
              background: 'rgba(255, 255, 255, 0.02)', 
              color: theme === 'dark' ? '#f0f0f5' : '#1e293b', 
              fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.85rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)' }}
          >
            {theme === 'dark' ? (
              <><i className="fas fa-sun" style={{ color: '#fbbf24' }}></i> Light Mode</>
            ) : (
              <><i className="fas fa-moon" style={{ color: '#818cf8' }}></i> Dark Mode</>
            )}
          </button>

          <button onClick={handleLogout} className="btn-logout">
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <main className="main-content">

        {/* ─────────── DASHBOARD ─────────── */}
        {activeTab === 'dashboard' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* Greeting */}
            <div className="section-header" style={{ marginBottom: '32px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px' }}>
                {getGreeting()} 👋
              </p>
              <h2 className="section-title" style={{ fontSize: '2.4rem' }}>
                {user.name ? `${user.name.split(' ')[0]}'s Dashboard` : 'Dashboard Overview'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px', fontWeight: 500 }}>
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
                <p className="stat-label" style={{ color: 'var(--text-muted)' }}>Pending Tasks</p>
                {tasks.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${taskCompletionPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: '4px', transition: 'width 0.6s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{taskCompletionPct}%</span>
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
                <p className="stat-label" style={{ color: 'var(--text-muted)' }}>Total Streak</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: 500 }}>
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
                <p className="stat-label" style={{ color: 'var(--text-muted)' }}>Latest Mood</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: 500 }}>
                  {diaries.length} jurnal ditulis
                </p>
              </div>
            </div>

            {/* ── Quote Card + Quick Notes ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
              {/* Daily Quote */}
              <div className="quote-card">
                <p className="quote-text">{dailyQuote.text}</p>
                <p className="quote-author">— {dailyQuote.author}</p>
              </div>

              {/* Quick Notes */}
              <div className="glass-card quick-notes-card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fas fa-sticky-note" style={{ color: '#fbbf24', fontSize: '0.8rem' }}></i>
                    Quick Notes
                  </h4>
                  <span className={`notes-saved-badge ${noteSaved ? 'visible' : ''}`}>
                    <i className="fas fa-check-circle"></i> Tersimpan
                  </span>
                </div>
                <textarea
                  className="quick-notes-textarea"
                  placeholder="Tulis catatan singkat, ide, atau reminder..."
                  value={quickNote}
                  onChange={e => handleNoteChange(e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <button
                onClick={() => setActiveTab('tasks')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.5s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                  <i className="fas fa-plus"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Tambah Task</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Buat tugas baru</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.55s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(45,212,191,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4bf', flexShrink: 0 }}>
                  <i className="fas fa-calendar-days"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Buka Kalender</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jadwalkan kegiatan</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('focus')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.6s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
                  <i className="fas fa-clock"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Focus Mode</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mulai sesi Pomodoro</p>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('diary')}
                className="glass-card"
                style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid rgba(129,140,248,0.08)', textAlign: 'left', animation: 'fadeInUp 0.5s ease-out 0.65s both' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', flexShrink: 0 }}>
                  <i className="fas fa-pen-fancy"></i>
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Tulis Jurnal</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ceritakan harimu</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─────────── CALENDAR ─────────── */}
        {activeTab === 'calendar' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div className="section-header">
              <h2 className="section-title">📅 Calendar</h2>
              <p className="section-subtitle">Jadwalkan kegiatan dan sinkronkan ke Google Calendar</p>
            </div>

            {/* Month Navigation */}
            <div className="cal-nav" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={prevMonth} className="cal-nav-btn">
                  <i className="fas fa-chevron-left"></i>
                </button>
                <button onClick={nextMonth} className="cal-nav-btn">
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
              <span className="cal-month-label">
                {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
              </span>
              <button onClick={goToday} className="cal-nav-btn" style={{ width: 'auto', padding: '0 14px', fontSize: '0.75rem', fontWeight: 700 }}>
                Hari ini
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="cal-grid">
              {/* Day headers */}
              {DAY_NAMES.map(d => (
                <div key={d} className="cal-day-header">{d}</div>
              ))}

              {/* Day cells */}
              {calDays.map((day, i) => {
                const hasEvents = eventsByDate[day.dateStr]?.length > 0;
                const hasTasks = tasksByDate[day.dateStr]?.length > 0;
                const hasDiaries = diariesByDate[day.dateStr]?.length > 0;
                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDate;

                return (
                  <div
                    key={i}
                    className={`cal-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => { setSelectedDate(day.dateStr); setShowEventModal(true); setShowAddEventForm(false); }}
                  >
                    <span className="cal-day-num">{day.date.getDate()}</span>
                    <div className="cal-dots">
                      {hasEvents && (eventsByDate[day.dateStr] || []).slice(0, 3).map((ev, ei) => (
                        <div key={ei} className="cal-dot" style={{ background: ev.color }}></div>
                      ))}
                      {hasTasks && <div className="cal-dot" style={{ background: '#818cf8' }}></div>}
                      {hasDiaries && <div className="cal-dot" style={{ background: '#4ade80' }}></div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px', animation: 'fadeIn 0.4s ease-out 0.2s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tasks</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Diary</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Events</span>
              </div>
            </div>

            {/* Google Calendar Connection Banner */}
            <div style={{ marginTop: '24px', padding: '16px 20px', background: 'rgba(66, 133, 244, 0.05)', border: '1px solid rgba(66, 133, 244, 0.15)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeInUp 0.5s ease-out 0.3s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(66, 133, 244, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4285f4', fontSize: '1.2rem' }}>
                  <i className="fab fa-google"></i>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>Google Calendar Auto-Save</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                    {googleToken ? '✅ Terhubung! Event baru akan otomatis tersimpan.' : 'Hubungkan untuk menyimpan event otomatis tanpa draft.'}
                  </p>
                </div>
              </div>
              {!googleToken ? (
                <button onClick={handleConnectGoogle} style={{ padding: '8px 16px', background: '#4285f4', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                  Connect
                </button>
              ) : (
                <span style={{ padding: '6px 12px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                  Connected
                </span>
              )}
            </div>
          </div>
        )}

        {/* ─────────── EVENT MODAL ─────────── */}
        {showEventModal && selectedDate && (
          <div className="modal-overlay" onClick={() => { setShowEventModal(false); setShowAddEventForm(false); }}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowEventModal(false); setShowAddEventForm(false); }} className="btn-close">
                <i className="fas fa-times" style={{ fontSize: '0.75rem' }}></i>
              </button>

              {/* Modal Header */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedEvents.length + selectedTasks.length + selectedDiaries.length} item di tanggal ini
                </p>
              </div>

              {/* Events list */}
              {selectedEvents.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Events
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedEvents.map((ev, i) => (
                      <div key={ev.id} className="event-item" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div className="event-color-dot" style={{ background: ev.color, marginTop: '5px' }}></div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{ev.title}</p>
                            {ev.startTime && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                <i className="fas fa-clock" style={{ fontSize: '0.65rem', marginRight: '4px' }}></i>
                                {ev.startTime}{ev.endTime ? ` — ${ev.endTime}` : ''}
                              </p>
                            )}
                            {ev.description && (
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>{ev.description}</p>
                            )}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              {!googleToken && (
                                <a
                                  href={generateGoogleCalendarUrl(ev)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-gcal"
                                >
                                  <i className="fab fa-google"></i>
                                  Google Calendar
                                </a>
                              )}
                              <button onClick={() => deleteEvent(ev.id)} className="btn-delete" style={{ fontSize: '0.75rem' }}>
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks on this date */}
              {selectedTasks.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    <i className="fas fa-check-double" style={{ marginRight: '6px', color: '#818cf8' }}></i>Tasks
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedTasks.map(t => (
                      <div key={t.id} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.is_done ? '#4ade80' : '#818cf8', flexShrink: 0 }}></div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: t.is_done ? '#666' : '#ddddf0', textDecoration: t.is_done ? 'line-through' : 'none' }}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diary entries on this date */}
              {selectedDiaries.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    <i className="fas fa-book" style={{ marginRight: '6px', color: '#4ade80' }}></i>Diary
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedDiaries.map(d => (
                      <div key={d.id} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.08)' }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{d.title}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{d.mood}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Event Form */}
              {!showAddEventForm ? (
                <button
                  onClick={() => setShowAddEventForm(true)}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <i className="fas fa-plus"></i>
                    Tambah Event Baru
                  </span>
                </button>
              ) : (
                <div style={{ marginTop: '8px', padding: '20px', borderRadius: '16px', background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.1)' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    ✨ Event Baru
                  </h4>
                  <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                      type="text" placeholder="Judul event..." value={newEvent.title}
                      onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="input-premium" required
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Mulai</label>
                        <input type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} className="input-premium" />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Selesai</label>
                        <input type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} className="input-premium" />
                      </div>
                    </div>
                    <textarea
                      placeholder="Deskripsi (opsional)..." value={newEvent.description}
                      onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="textarea-premium" style={{ minHeight: '70px' }}
                    ></textarea>

                    {/* Color Picker */}
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>Warna</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {EVENT_COLORS.map(c => (
                          <div
                            key={c}
                            className={`color-option ${newEvent.color === c ? 'selected' : ''}`}
                            style={{ background: c }}
                            onClick={() => setNewEvent({ ...newEvent, color: c })}
                          ></div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                        <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <i className="fas fa-check"></i> Simpan
                        </span>
                      </button>
                      <button type="button" onClick={() => setShowAddEventForm(false)} style={{
                        padding: '12px 20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600
                      }}>
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              )}
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
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {completedTasks} dari {tasks.length} selesai
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                        fontWeight: 600, fontSize: '0.95rem',
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
                          <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{h.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>{tier.icon}</span>
                            <span className={tier.class} style={{ fontWeight: 800, fontSize: '1.4rem' }}>{h.streak}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>hari streak</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => checkInHabit(h.id)} className="habit-checkin-btn">🔥</button>
                          <button onClick={() => deleteHabit(h.id)} className="btn-delete">
                            <i className="fas fa-trash" style={{ fontSize: '0.8rem' }}></i>
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: '16px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(h.streak / 30 * 100, 100)}%`, height: '100%',
                          background: h.streak >= 30 ? 'linear-gradient(90deg, #f59e0b, #fcd34d)' : h.streak >= 7 ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' : 'linear-gradient(90deg, #a78242, #cd9b5a)',
                          borderRadius: '3px', transition: 'width 0.6s ease'
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
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-pen-fancy" style={{ color: '#818cf8', fontSize: '0.9rem' }}></i>
                  Tulis Jurnal Baru
                </h3>
                <form onSubmit={handleAddDiary} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <input type="text" placeholder="Judul..." value={newDiary.title} onChange={e => setNewDiary({ ...newDiary, title: e.target.value })} className="input-premium" />
                  <select value={newDiary.mood} onChange={e => setNewDiary({ ...newDiary, mood: e.target.value })} className="select-premium">
                    <option value="Happy">😁 Happy</option>
                    <option value="Neutral">😐 Neutral</option>
                    <option value="Sad">😢 Sad</option>
                    <option value="On Fire">🔥 On Fire</option>
                  </select>
                  <textarea placeholder="Ceritakan harimu..." value={newDiary.content} onChange={e => setNewDiary({ ...newDiary, content: e.target.value })} className="textarea-premium"></textarea>
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
                          <h3 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{d.title}</h3>
                          <span className={`mood-badge ${moodClass}`}>{d.mood}</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{d.content}</p>
                        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${curMode.color}08, transparent 70%)`,
              filter: 'blur(60px)', pointerEvents: 'none', transition: 'background 0.6s ease',
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
              display: 'flex', gap: '6px', marginBottom: '40px', marginTop: '16px',
              padding: '6px', borderRadius: '16px',
              background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.05)',
            }}>
              {Object.entries(MODES).map(([key, val]) => (
                <button key={key} onClick={() => changeMode(key)} className="focus-mode-tab"
                  style={pomMode === key
                    ? { background: val.color + '15', color: val.color, borderColor: val.color + '30', boxShadow: `0 0 16px ${val.color}10` }
                    : { color: 'var(--text-muted)' }}
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
                <circle cx="140" cy="140" r={RADIUS + 14} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                <circle cx="140" cy="140" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                <circle cx="140" cy="140" r={RADIUS} fill="none"
                  stroke={curMode.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={offset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '140px 140px', transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                />
                <circle cx="140" cy="140" r={RADIUS} fill="none"
                  stroke={curMode.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={offset}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '140px 140px', transition: 'stroke-dashoffset 1s linear, stroke 0.4s', filter: `blur(8px)`, opacity: 0.3 }}
                />
                {pct < 1 && (
                  <circle cx={dotX} cy={dotY} r="6" fill={curMode.color}
                    style={{ filter: `drop-shadow(0 0 8px ${curMode.color})` }} />
                )}
                <text x="140" y="124" textAnchor="middle" fill="white" fontSize="42" fontWeight="900" fontFamily="'JetBrains Mono', 'Courier New', monospace">{fmt(timeLeft)}</text>
                <text x="140" y="152" textAnchor="middle" fill={curMode.color} fontSize="11" fontWeight="700" letterSpacing="3">{curMode.label.toUpperCase()}</text>
                <text x="140" y="174" textAnchor="middle" fill="#444466" fontSize="11" fontWeight="600">Sesi #{sessCount + 1}</text>
              </svg>

              {isRunning && (
                <>
                  <div style={{ position: 'absolute', inset: '-10px', borderRadius: '50%', border: `2px solid ${curMode.color}`, animation: 'ring-pulse 2s ease-out infinite', pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', inset: '-10px', borderRadius: '50%', border: `2px solid ${curMode.color}`, animation: 'ring-pulse 2s ease-out 0.7s infinite', pointerEvents: 'none' }}></div>
                </>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
              <button onClick={resetTimer} className="focus-control-btn">
                <i className="fas fa-redo" style={{ fontSize: '0.85rem' }}></i>
              </button>
              <button onClick={toggleTimer} className="focus-play-btn"
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
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, marginRight: '4px' }}>Sesi selesai:</span>
                {Array.from({ length: Math.min(sessCount, 8) }).map((_, i) => (
                  <div key={i} className="session-dot"
                    style={{ background: MODES.focus.color, boxShadow: `0 0 8px ${MODES.focus.shadow}`, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
                {sessCount > 8 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>+{sessCount - 8}</span>}
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
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Tasks</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#818cf8', marginTop: '4px' }}>{tasks.length}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.1s both' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Completed</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#4ade80', marginTop: '4px' }}>{completedTasks}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.15s both' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Habits</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24', marginTop: '4px' }}>{habits.length}</p>
              </div>
              <div className="glass-card" style={{ padding: '20px 24px', animation: 'fadeInUp 0.4s ease-out 0.2s both' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Journal</p>
                <p style={{ fontSize: '2rem', fontWeight: 900, color: '#60a5fa', marginTop: '4px' }}>{diaries.length}</p>
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass-card chart-card" style={{ animationDelay: '0.15s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 8px rgba(129,140,248,0.4)' }}></span>
                  <span style={{ color: 'var(--text-primary)' }}>Penyelesaian Tugas</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.tasks} innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                        <Cell fill="#818cf8" />
                        <Cell fill="rgba(255,255,255,0.06)" />
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
                      <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: '0.8rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card chart-card" style={{ animationDelay: '0.25s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }}></span>
                  <span style={{ color: 'var(--text-primary)' }}>Performa Habit (Streak)</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.habits}>
                      <XAxis dataKey="name" stroke="#444466" fontSize={11} fontFamily="Outfit" />
                      <YAxis stroke="#444466" fontSize={11} fontFamily="Outfit" />
                      <Tooltip cursor={{ fill: 'rgba(129,140,248,0.04)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
                      <Bar dataKey="value" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card chart-card" style={{ gridColumn: '1 / -1', animationDelay: '0.35s' }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px rgba(74,222,128,0.4)' }}></span>
                  <span style={{ color: 'var(--text-primary)' }}>Analisis Suasana Hati</span>
                </h3>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.moods} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#ddddf0" fontSize={12} fontFamily="Outfit" width={80} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontFamily: 'Outfit', fontSize: '0.85rem' }} />
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