import React, { useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Clock, CreditCard, Download, FileText, GraduationCap, Home, Menu, MessageCircle, MoreHorizontal, Palette, Plus, Search, Settings, ShieldCheck, Sparkles, Users, Wallet, X, CheckCircle2, AlertCircle, Smartphone, Filter, UserRound, CalendarCheck, Banknote } from 'lucide-react';
import { apiStudentId, ApiError, clearToken, getToken, loadStore, request, setToken, type Fee, type Store, type Student, type StudioUser } from './api';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const initial: Store = { students: [], fees: [], payments: [], attendance: [] };
const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const shortDate = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const navItems = [['Home', Home], ['Students', Users], ['Attendance', CalendarCheck], ['Fees', Wallet], ['More', MoreHorizontal]] as const;
export default function App() {
    const [store, setStore] = useState<Store>(initial); const [page, setPage] = useState('Home'); const [search, setSearch] = useState(''); const [showAdd, setShowAdd] = useState(false); const [selected, setSelected] = useState<Student | null>(null); const [toast, setToast] = useState(''); const [attendanceDate, setAttendanceDate] = useState(today); const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${today}T00:00:00`)); const [feeFilter, setFeeFilter] = useState('All'); const [paying, setPaying] = useState<Fee | null>(null); const [paymentAmount, setPaymentAmount] = useState('200'); const [paymentMethod, setPaymentMethod] = useState('UPI'); const [studentForm, setStudentForm] = useState({ name: '', guardian: '', phone: '', group: 'Class 5', joined: today });
    const [authUser, setAuthUser] = useState<StudioUser | null>(null); const [authStatus, setAuthStatus] = useState<'checking' | 'login' | 'register' | 'ready' | 'error'>('checking'); const [authMode, setAuthMode] = useState<'login' | 'register'>('login'); const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' }); const [authError, setAuthError] = useState(''); const [authBusy, setAuthBusy] = useState(false);
    async function refreshStore() { setStore(await loadStore()); }
    function handleApiError(error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
            clearToken();
            setAuthUser(null);
            setAuthStatus('login');
            setToast('Your session expired. Please sign in again.');
            return;
        }
        setToast(error instanceof Error ? error.message : 'The request failed. Please try again.');
    }
    useEffect(() => {
        let cancelled = false;
        async function bootstrap() {
            try {
                localStorage.removeItem('artvista-store');
                localStorage.removeItem('artvista-empty-store-v1');
                const status = await request<{ registrationOpen: boolean }>('/auth/status');
                if (cancelled) return;
                if (status.registrationOpen) {
                    clearToken();
                    setAuthMode('register');
                    setAuthStatus('register');
                    return;
                }
                if (getToken()) {
                    try {
                        const user = await request<StudioUser>('/auth/me');
                        if (!cancelled) { setAuthUser(user); setAuthStatus('ready'); }
                    } catch (error) {
                        if (error instanceof ApiError && error.status === 401) {
                            clearToken();
                            if (!cancelled) setAuthStatus('login');
                        } else {
                            throw error;
                        }
                    }
                } else {
                    setAuthMode('login');
                    setAuthStatus('login');
                }
            } catch (error) {
                if (!cancelled) {
                    setAuthError(error instanceof Error ? error.message : 'Unable to connect to ArtVista.');
                    setAuthStatus('error');
                }
            }
        }
        void bootstrap();
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!authUser) return;
        let cancelled = false;
        void loadStore().then(data => {
            if (!cancelled) setStore(data);
        }).catch(error => {
            if (!cancelled) handleApiError(error);
        });
        return () => { cancelled = true; };
    }, [authUser]);
    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t); } }, [toast]);
    const active = store.students.filter(s => s.active); const totalDue = store.fees.reduce((sum, f) => sum + Math.max(0, f.amount - f.paid), 0); const collected = store.payments.filter(p => p.date.slice(0, 7) === today.slice(0, 7)).reduce((s, p) => s + p.amount, 0);
    const presentToday = store.attendance.filter(a => a.date === attendanceDate && a.present).length; const markedToday = store.attendance.filter(a => a.date === attendanceDate).length;
    const calendarYear = calendarMonth.getFullYear(); const calendarMonthIndex = calendarMonth.getMonth(); const calendarDays = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate(); const calendarOffset = new Date(calendarYear, calendarMonthIndex, 1).getDay();
    const studentById = (id: string) => store.students.find(s => s.id === id);
    async function markAttendance(student: Student, present: boolean) {
        const current = store.attendance.find(record => record.date === attendanceDate && record.studentId === student.id);
        if (current?.present === present) return;
        try {
            await request('/attendance', { method: 'POST', body: JSON.stringify({ date: attendanceDate, studentId: apiStudentId(student), present }) });
            await refreshStore();
            setToast(present ? 'Attendance saved' : 'Marked absent');
        } catch (error) { handleApiError(error); }
    }
    async function markAllPresent() {
        try {
            for (const student of active) {
                const current = store.attendance.find(record => record.date === attendanceDate && record.studentId === student.id);
                if (current?.present) continue;
                await request('/attendance', { method: 'POST', body: JSON.stringify({ date: attendanceDate, studentId: apiStudentId(student), present: true }) });
            }
            await refreshStore();
            setToast('Attendance saved for all active students');
        } catch (error) { handleApiError(error); }
    }
    async function addStudent(e: React.FormEvent) {
        e.preventDefault();
        if (!studentForm.name.trim() || !studentForm.guardian.trim() || !studentForm.phone.trim()) { setToast('Please complete required fields'); return; }
        try {
            await request('/students', { method: 'POST', body: JSON.stringify(studentForm) });
            await refreshStore();
            setShowAdd(false);
            setStudentForm({ name: '', guardian: '', phone: '', group: 'Class 5', joined: today });
            setToast('Student added successfully');
        } catch (error) { handleApiError(error); }
    }
    async function collectPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!paying) return;
        const amount = Number(paymentAmount);
        const due = paying.amount - paying.paid;
        if (!Number.isFinite(amount) || amount <= 0 || amount > due) { setToast(`Enter an amount up to ${money(due)}`); return; }
        const student = store.students.find(item => item.id === paying.studentId);
        if (!student) { setToast('Student record not found. Reload and try again.'); return; }
        try {
            await request('/payments', { method: 'POST', body: JSON.stringify({ studentId: student.dbId, feeId: paying.dbId, amount, method: paymentMethod, date: today }) });
            await refreshStore();
            setPaying(null);
            setToast('Payment recorded successfully');
        } catch (error) { handleApiError(error); }
    }
    const filteredStudents = store.students.filter(s => `${s.name} ${s.id} ${s.phone}`.toLowerCase().includes(search.toLowerCase()));
    const dueFees = store.fees.filter(f => f.paid < f.amount).filter(f => feeFilter === 'All' || (feeFilter === 'Due' && f.paid === 0) || (feeFilter === 'Partially Paid' && f.paid > 0));
    function whatsapp(student: Student, fee?: Fee) { const amount = fee ? fee.amount - fee.paid : store.fees.filter(f => f.studentId === student.id).reduce((sum, f) => sum + f.amount - f.paid, 0); const msg = `Hello ${student.guardian}, this is a friendly reminder from ArtVista Art School. ${student.name} has completed four Sunday art classes. The current outstanding balance is ${money(amount)}. Kindly pay the pending fee at your convenience. Thank you!`; const phone = student.phone.replace(/\D/g, ''); if (!phone) { setToast('Please add a valid guardian phone number'); return; } window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer'); setToast('WhatsApp opened — review and send the message'); }
    const dueStudentCount = new Set(store.fees.filter(f => f.paid < f.amount).map(f => f.studentId)).size;
    function signOut() { clearToken(); setAuthUser(null); setStore(initial); setAuthMode('login'); setAuthStatus('login'); setPage('Home'); }
    function exportBackup() {
        const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...store }, null, 2);
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `artvista-backup-${today}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
    async function submitAuth(e: React.FormEvent) {
        e.preventDefault();
        setAuthBusy(true);
        setAuthError('');
        try {
            const path = authMode === 'register' ? '/auth/register' : '/auth/login';
            const result = await request<{ token: string; user: StudioUser }>(path, {
                method: 'POST',
                body: JSON.stringify(authMode === 'register'
                    ? authForm
                    : { email: authForm.email, password: authForm.password }),
            });
            setToken(result.token);
            setAuthUser(result.user);
            setAuthStatus('ready');
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Unable to authenticate.');
        } finally {
            setAuthBusy(false);
        }
    }
    if (authStatus === 'checking') return <div className="auth-screen"><div className="auth-card"><Palette size={28} /><h1>ArtVista</h1><p>Connecting to your studio...</p></div></div>;
    if (authStatus === 'error') return <div className="auth-screen"><div className="auth-card"><Palette size={28} /><h1>ArtVista is unavailable</h1><p>{authError}</p><button className="primary-btn" onClick={() => window.location.reload()}>Try again</button></div></div>;
    if (!authUser) return <div className="auth-screen"><form className="auth-card" onSubmit={submitAuth}><Palette size={28} /><h1>{authMode === 'register' ? 'Set up your studio' : 'Welcome back'}</h1><p>{authMode === 'register' ? 'Create the first administrator account for this ArtVista database.' : 'Sign in to manage your students and studio records.'}</p>{authMode === 'register' && <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} /></label>}<label>Email<input type="email" autoComplete="email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /></label><label>Password<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 10 : 1} required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />{authMode === 'register' && <small>Use at least 10 characters.</small>}</label>{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="primary-btn" type="submit" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'register' ? 'Create studio' : 'Sign in'}</button></form></div>;
    return <><div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Palette size={24} /><Sparkles size={12} /></div><div><b>ArtVista</b><small>Art School Management</small></div></div><div className="side-label">WORKSPACE</div>{navItems.map(([label, Icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => setPage(label)}><Icon size={19} /><span>{label}</span>{label === 'Fees' && dueStudentCount > 0 && <em>{dueStudentCount}</em>}</button>)}<div className="side-label second">PREFERENCES</div><button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => setPage('Settings')}><Settings size={19} /><span>Settings</span></button><div className="sidebar-art"><div className="art-spark">✳</div><p>Small steps create<br />big artists.</p><div className="paint-pots"><i /><i /><i /></div></div><div className="side-bottom"><span className="online-dot" /> Connected to MongoDB <span className="version">v1.0</span></div></aside>
        <main className="main"><header className="topbar"><button className="mobile-brand" onClick={() => setPage('Home')}><Palette size={21} /> ArtVista</button><div className="search-global"><Search size={17} /><input placeholder="Search students, ID, phone..." value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setPage('Students'); }} /><kbd>⌘ K</kbd></div><div className="top-actions"><button className="icon-button" onClick={() => setPage('Reminders')} aria-label="Notifications"><Bell size={19} /><i /></button><div className="profile-chip"><div className="avatar admin">{initials(authUser.name)}</div><div><b>{authUser.name}</b><small>{authUser.email}</small></div><ChevronDown size={15} /></div></div></header>
            <div className="content">{page === 'Home' && <><section className="welcome"><div className="welcome-copy"><span className="eyebrow"><Sparkles size={13} /> YOUR CREATIVE SPACE</span><h1>Good morning, Aminur <span>✦</span></h1><p>More art. More smiles. More creative minds.</p><div className="welcome-tags"><span><span className="tiny-dot purple" /> Your studio at a glance</span><span><CalendarDays size={13} /> {shortDate(today)}</span></div></div><div className="welcome-art"><div className="sun-orb" /><div className="paint-swoosh one" /><div className="paint-swoosh two" /><div className="brush">✎</div><div className="floating-star">✧</div></div></section>
                <div className="stats-grid"><StatCard title="Total students" value={active.length.toString()} note={`+${store.students.length - active.length} inactive`} icon={<Users />} tone="lilac" /><StatCard title="Present today" value={`${presentToday} / ${active.length}`} note={markedToday ? `${Math.round(presentToday / Math.max(1, markedToday) * 100)}% of marked` : 'Attendance not marked'} icon={<CalendarCheck />} tone="mint" /><StatCard title="Collected this month" value={money(collected)} note={`${store.payments.filter(p => p.date.slice(0, 7) === today.slice(0, 7)).length} payments`} icon={<CircleDollarSign />} tone="peach" /><StatCard title="Outstanding fees" value={money(totalDue)} note={`${dueStudentCount} students`} icon={<AlertCircle />} tone="rose" /></div>
                <div className="dashboard-grid"><div className="stack"><section className="panel attendance-panel"><div className="panel-head"><div className="title-with-icon"><div className="mini-icon lilac"><Activity size={17} /></div><div><h2>Attendance overview</h2><p>Your studio's weekly rhythm</p></div></div><button className="text-link" onClick={() => setPage('Attendance')}>View attendance <ArrowUpRight size={14} /></button></div><div className="chart-area"><div className="chart-y"><span>24</span><span>18</span><span>12</span><span>6</span><span>0</span></div><div className="chart-main"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 500 150" preserveAspectRatio="none" className="line-chart"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7778ff" stopOpacity=".22" /><stop offset="100%" stopColor="#7778ff" stopOpacity="0" /></linearGradient></defs><path d="M0 116 C45 115 58 79 100 86 S160 115 210 71 S290 92 335 57 S420 54 500 20 L500 150 L0 150 Z" fill="url(#areaFill)" /><path d="M0 116 C45 115 58 79 100 86 S160 115 210 71 S290 92 335 57 S420 54 500 20" fill="none" stroke="#6865f2" strokeWidth="3" strokeLinecap="round" /><circle cx="100" cy="86" r="4" fill="#6865f2" stroke="white" strokeWidth="2" /><circle cx="210" cy="71" r="4" fill="#6865f2" stroke="white" strokeWidth="2" /><circle cx="335" cy="57" r="4" fill="#6865f2" stroke="white" strokeWidth="2" /><circle cx="500" cy="20" r="4" fill="#6865f2" stroke="white" strokeWidth="2" /></svg><div className="chart-x"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>This week</span></div></div><div className="attendance-ring"><div className="ring" style={{ '--percent': `${active.length ? presentToday / active.length * 100 : 0}%` } as React.CSSProperties}><div><b>{active.length ? Math.round(presentToday / active.length * 100) : 0}%</b><small>Present</small></div></div><div className="legend"><span><i className="green-dot" /> Present <b>{presentToday}</b></span><span><i className="gray-dot" /> Absent <b>{Math.max(0, markedToday - presentToday)}</b></span><span><i className="blue-dot" /> Active <b>{active.length}</b></span></div></div></div></section>
                    <section className="panel"><div className="panel-head"><div className="title-with-icon"><div className="mini-icon peach"><Wallet size={17} /></div><div><h2>Recent payments</h2><p>Latest activity from your studio</p></div></div><button className="text-link" onClick={() => setPage('History')}>View all <ArrowUpRight size={14} /></button></div><div className="payment-list">{store.payments.slice(0, 4).map(p => <div className="payment-row" key={p.id}><div className={`avatar ${avatarTone(p.studentId)}`}>{studentById(p.studentId)?.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</div><div className="payment-person"><b>{studentById(p.studentId)?.name || 'Student'}</b><small>{shortDate(p.date)}</small></div><span className="method-pill">{p.method}</span><b className="amount">{money(p.amount)}</b><CheckCircle2 size={16} className="paid-check" /></div>)}{store.payments.length === 0 && <Empty text="No payments recorded yet." />}</div></section></div>
                    <div className="stack side-stack"><section className="panel quick-panel"><div className="panel-head"><div className="title-with-icon"><div className="mini-icon blue"><Sparkles size={17} /></div><h2>Quick actions</h2></div></div><div className="quick-grid"><button onClick={() => setShowAdd(true)} className="quick-action lilac"><span><Plus /></span><b>Add student</b><small>Enroll a new artist</small></button><button onClick={() => setPage('Attendance')} className="quick-action mint"><span><CalendarCheck /></span><b>Mark attendance</b><small>Record today's class</small></button><button onClick={() => { setPage('Fees'); setFeeFilter('Due'); }} className="quick-action peach"><span><Banknote /></span><b>Collect fee</b><small>Record a payment</small></button><button onClick={() => setPage('Reminders')} className="quick-action rose"><span><MessageCircle /></span><b>Fee reminders</b><small>Message guardians</small></button></div></section><section className="panel cycle-panel"><div className="panel-head"><div className="title-with-icon"><div className="mini-icon mint"><CalendarDays size={17} /></div><div><h2>Fee cycle progress</h2><p>Students nearing their next fee</p></div></div><button className="text-link" onClick={() => setPage('Students')}>See all</button></div>{[...active].sort((a, b) => b.progress - a.progress).slice(0, 4).map(s => <div className="cycle-row" key={s.id}><div className={`avatar ${avatarTone(s.id)}`}>{initials(s.name)}</div><div className="cycle-info"><div><b>{s.name}</b><small>{s.progress}/4 Sundays</small></div><div className="progress-track"><i style={{ width: `${s.progress / 4 * 100}%`, background: progressColor(s.progress) }} /></div></div>{s.progress === 3 ? <span className="almost">Almost</span> : null}</div>)}</section><section className="quote-card"><div className="quote-spark">✦</div><p>“Every child is an artist. The problem is how to remain an artist once we grow up.”</p><small>— Pablo Picasso</small><div className="quote-swatches"><i /><i /><i /></div></section></div></div></>}
                {page === 'Students' && <section className="page-section"><PageHeading eyebrow="YOUR LITTLE ARTISTS" title="Students" desc="Every artist's journey starts somewhere." action={<button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={17} /> Add student</button>} /><div className="filter-row"><div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ID or phone..." /></div><button className="soft-button" onClick={() => setSearch('')}><Filter size={15} /> Clear filters</button></div><div className="student-grid">{filteredStudents.map(s => <button className="student-card" key={s.id} onClick={() => setSelected(s)}><div className="student-card-top"><div className={`avatar large ${avatarTone(s.id)}`}>{initials(s.name)}</div><span className={`status ${s.active ? 'status-active' : 'status-inactive'}`}>{s.active ? 'Active' : 'Inactive'}</span></div><h3>{s.name}</h3><p>{s.id} · {s.group}</p><div className="student-card-bottom"><div><small>Fee cycle</small><b>{s.progress}/4 Sundays</b></div><div className="small-progress"><i style={{ width: `${s.progress * 25}%` }} /></div><ChevronDown size={17} /></div></button>)}</div>{filteredStudents.length === 0 && <Empty text="No students found. Try another search or add a student." />}</section>}
                {page === 'Attendance' && <section className="page-section"><PageHeading eyebrow="SUNDAY STUDIO" title="Mark attendance" desc="Only attended classes count toward a student's four-class fee cycle." action={<button className="soft-button" onClick={() => { setAttendanceDate(today); setToast('Date set to today') }}><CalendarDays size={16} /> Today</button>} /><div className="attendance-summary"><div><small>Selected class date</small><input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} /></div><div><small>Active students</small><b>{active.length}</b></div><div><small>Present</small><b className="text-green">{presentToday}</b></div><div><small>Absent / unmarked</small><b>{Math.max(0, active.length - presentToday)}</b></div></div><div className="panel attendance-list-panel"><div className="panel-head"><div><h2>Class register</h2><p>{shortDate(attendanceDate)} · {markedToday} of {active.length} marked</p></div><button className="soft-button" onClick={() => void markAllPresent()}><Check size={15} /> Mark all present</button></div>{active.map(s => { const rec = store.attendance.find(a => a.date === attendanceDate && a.studentId === s.id); return <div className="attendee-row" key={s.id}><div className={`avatar ${avatarTone(s.id)}`}>{initials(s.name)}</div><div className="attendee-info"><b>{s.name}</b><small>{s.id} · Fee cycle {s.progress}/4</small></div><button className={`attendance-choice ${rec?.present ? 'chosen-present' : ''}`} onClick={() => markAttendance(s, true)}><Check size={14} /> Present</button><button className={`attendance-choice ${rec && !rec.present ? 'chosen-absent' : ''}`} onClick={() => markAttendance(s, false)}><X size={14} /> Absent</button></div> })}</div></section>}
                {page === 'Fees' && <section className="page-section"><PageHeading eyebrow="STUDIO FINANCES" title="Fees & payments" desc="A fee of ₹200 is due after every four attended Sundays." action={<button className="soft-button" onClick={() => setPage('History')}><FileText size={16} /> Payment history</button>} /><div className="stats-grid three"><StatCard title="Total outstanding" value={money(totalDue)} note={`${dueStudentCount} students with dues`} icon={<AlertCircle />} tone="rose" /><StatCard title="Collected this month" value={money(collected)} note="Recorded payments" icon={<CircleDollarSign />} tone="mint" /><StatCard title="Fee obligations" value={store.fees.length.toString()} note={`${store.fees.filter(f => f.paid === f.amount).length} fully paid`} icon={<CreditCard />} tone="lilac" /></div><div className="filter-tabs">{['All', 'Due', 'Partially Paid'].map(f => <button key={f} className={feeFilter === f ? 'selected' : ''} onClick={() => setFeeFilter(f)}>{f}</button>)}</div><div className="panel fee-list">{dueFees.map(f => { const s = studentById(f.studentId); if (!s) return null; const due = f.amount - f.paid; return <div className="fee-row" key={f.id}><div className={`avatar ${avatarTone(s.id)}`}>{initials(s.name)}</div><div className="fee-person"><b>{s.name}</b><small>{f.id} · Created {shortDate(f.created)}</small><div className="fee-progress-mini"><i style={{ width: `${f.paid / f.amount * 100}%` }} /></div></div><div className="fee-values"><b>{money(due)}</b><span className={`status ${f.paid ? 'status-partial' : 'status-due'}`}>{f.paid ? 'Partially paid' : 'Due'}</span></div><button className="primary-btn small" onClick={() => { setPaying(f); setPaymentAmount(String(due)); }}>Collect</button><button className="icon-button plain" onClick={() => whatsapp(s, f)} title="WhatsApp reminder"><MessageCircle size={18} /></button></div> })}{dueFees.length === 0 && <Empty text="No fees in this filter. Nice work!" />}</div></section>}
                {page === 'History' && <section className="page-section"><PageHeading eyebrow="PAYMENT RECORDS" title="Payment history" desc="Every payment recorded for your art school." action={<button className="soft-button" onClick={() => { const rows = [['Payment ID', 'Student', 'Amount', 'Method', 'Date'], ...store.payments.map(p => [p.id, studentById(p.studentId)?.name || '', p.amount, p.method, p.date])]; const csv = rows.map(r => r.join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'artvista-payments.csv'; a.click(); URL.revokeObjectURL(a.href); }}><Download size={16} /> Export CSV</button>} /><div className="panel"><div className="panel-head"><div><h2>All transactions</h2><p>{store.payments.length} recorded payments</p></div><b className="total-highlight">{money(store.payments.reduce((s, p) => s + p.amount, 0))} total</b></div>{store.payments.map(p => <div className="payment-row history-row" key={p.id}><div className={`avatar ${avatarTone(p.studentId)}`}>{initials(studentById(p.studentId)?.name || 'ST')}</div><div className="payment-person"><b>{studentById(p.studentId)?.name || 'Student'}</b><small>{p.id} · {shortDate(p.date)}</small></div><span className="method-pill">{p.method}</span><b className="amount">{money(p.amount)}</b><CheckCircle2 size={16} className="paid-check" /></div>)}{!store.payments.length && <Empty text="No payment records yet." />}</div></section>}
                {page === 'Reminders' && <section className="page-section"><PageHeading eyebrow="A LITTLE NUDGE" title="WhatsApp reminders" desc="Open a ready-to-send, personalized reminder for each guardian." /><div className="reminder-note"><MessageCircle size={20} /><div><b>Manual sending keeps you in control</b><p>WhatsApp opens with a prepared message. Review it and tap Send inside WhatsApp.</p></div></div><div className="reminder-grid">{store.fees.filter(f => f.paid < f.amount).map(f => { const s = studentById(f.studentId); if (!s) return null; return <div className="reminder-card" key={f.id}><div className={`avatar large ${avatarTone(s.id)}`}>{initials(s.name)}</div><div className="reminder-details"><b>{s.name}</b><small>Guardian: {s.guardian}</small><small>+{s.phone}</small><div className="reminder-due">Fee due <b>{money(f.amount - f.paid)}</b></div></div><button className="whatsapp-btn" onClick={() => whatsapp(s, f)}><MessageCircle size={17} /> Open WhatsApp</button></div> })}{!dueFees.length && <Empty text="No outstanding fees to remind." />}</div></section>}
                {page === 'More' && <section className="page-section"><PageHeading eyebrow="YOUR STUDIO TOOLS" title="More" desc="Everything else to keep your art school running smoothly." /><div className="more-grid">{[[CalendarDays, 'Calendar', 'View Sunday class dates', 'Calendar'], [MessageCircle, 'WhatsApp reminders', 'Follow up on fee dues', 'Reminders'], [FileText, 'Reports', 'Review collections and attendance', 'Reports'], [Settings, 'Settings', 'Manage your studio preferences', 'Settings'], [ShieldCheck, 'Data backup', 'Download a JSON copy of MongoDB records', 'Backup']].map(([Icon, title, desc, target]: any) => <button className="more-card" key={title} onClick={() => setPage(target)}><div className="mini-icon lilac"><Icon size={20} /></div><div><b>{title}</b><p>{desc}</p></div><ArrowUpRight size={16} /></button>)}</div></section>}
                {page === 'Backup' && <section className="page-section"><PageHeading eyebrow="YOUR STUDIO DATA" title="Data backup" desc="Download a snapshot of the records currently loaded from MongoDB." /><div className="panel settings-panel"><p>Includes students, attendance, fee obligations, and payments. Store this file somewhere private because it contains student and guardian details.</p><button className="primary-btn" onClick={exportBackup}><Download size={16} /> Download JSON backup</button></div></section>}
                {page === 'Calendar' && <section className="page-section">
                    <PageHeading eyebrow="PLAN YOUR SUNDAYS" title="Class calendar" desc="Choose a class date to record or review attendance." action={<button className="soft-button" onClick={() => { setCalendarMonth(new Date(`${today}T00:00:00`)); setAttendanceDate(today); }}><CalendarDays size={16} /> Today</button>} />
                    <div className="calendar-attendance-layout">
                        <div className="panel calendar-panel">
                            <div className="calendar-month-heading">
                                <button className="icon-button plain" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))}><ChevronLeft size={20} /></button>
                                <h2>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
                                <button className="icon-button plain" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))}><ChevronRight size={20} /></button>
                            </div>
                            <div className="calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <b key={d}>{d}</b>)}{Array.from({ length: calendarOffset }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: calendarDays }, (_, i) => {
                                const day = i + 1;
                                const date = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSunday = new Date(calendarYear, calendarMonthIndex, day).getDay() === 0;
                                const dayRecords = store.attendance.filter(record => record.date === date);
                                return <button key={date} className={`${isSunday ? 'sunday' : ''} ${date === today ? 'is-today' : ''} ${date === attendanceDate ? 'is-selected' : ''} ${dayRecords.length ? 'has-attendance' : ''}`} aria-label={`${date}${dayRecords.length ? `, ${dayRecords.length} attendance records` : ''}`} onClick={() => setAttendanceDate(date)}>{day}{dayRecords.length > 0 && <i />}</button>;
                            })}</div>
                            <div className="calendar-legend"><i /> Attendance recorded <span className="calendar-sunday-key" /> Sunday class day</div>
                        </div>
                        <div className="panel calendar-register">
                            <div className="panel-head">
                                <div><h2>Class register</h2><p>{shortDate(attendanceDate)} · {markedToday} of {active.length} marked</p></div>
                                <button className="soft-button" onClick={() => void markAllPresent()} disabled={active.length === 0}><Check size={15} /> Mark all present</button>
                            </div>
                            <div className="calendar-attendance-summary"><span>{active.length} active students</span><b>{presentToday} present</b><span>{Math.max(0, active.length - markedToday)} not marked</span></div>
                            {active.map(student => {
                                const record = store.attendance.find(item => item.date === attendanceDate && item.studentId === student.id);
                                return <div className="attendee-row" key={student.id}><div className={`avatar ${avatarTone(student.id)}`}>{initials(student.name)}</div><div className="attendee-info"><b>{student.name}</b><small>{student.id} · Fee cycle {student.progress}/4</small></div><button className={`attendance-choice ${record?.present ? 'chosen-present' : ''}`} onClick={() => void markAttendance(student, true)}><Check size={14} /> Present</button><button className={`attendance-choice ${record && !record.present ? 'chosen-absent' : ''}`} onClick={() => void markAttendance(student, false)}><X size={14} /> Absent</button></div>;
                            })}
                            {active.length === 0 && <Empty text="Add active students to start recording attendance." />}
                        </div>
                    </div>
                </section>}
                {page === 'Settings' && <section className="page-section"><PageHeading eyebrow="YOUR PREFERENCES" title="Settings" desc="Personalize ArtVista for your studio." /><div className="panel settings-panel"><div className="settings-row"><div className="mini-icon lilac"><GraduationCap /></div><div><b>ArtVista Art School</b><p>Your connected studio workspace</p></div><span className="settings-value">{authUser.email}</span></div><div className="settings-row"><div className="mini-icon mint"><Wallet /></div><div><b>Monthly fee</b><p>Amount due after four attended Sundays</p></div><b>₹200</b></div><div className="settings-row"><div className="mini-icon peach"><CalendarCheck /></div><div><b>Fee cycle</b><p>Only marked-present classes count</p></div><b>4 classes</b></div><div className="settings-row"><div className="mini-icon blue"><Clock /></div><div><b>Timezone</b><p>Dates and payment records</p></div><b>Asia/Kolkata</b></div><div className="settings-row"><div className="mini-icon rose"><ShieldCheck /></div><div><b>Account</b><p>Sign out of this studio on this device.</p></div><button className="soft-button" onClick={signOut}>Sign out</button></div><div className="settings-footnote">Student, attendance, fee, and payment records are stored in MongoDB and retrieved through the authenticated ArtVista API.</div></div></section>}
                {page === 'Reports' && <section className="page-section"><PageHeading eyebrow="YOUR STUDIO AT A GLANCE" title="Reports" desc="Quick summaries from your MongoDB studio records." /><div className="stats-grid three"><StatCard title="Active students" value={active.length.toString()} note="Currently enrolled" icon={<Users />} tone="lilac" /><StatCard title="Recorded payments" value={store.payments.length.toString()} note="All time" icon={<CreditCard />} tone="mint" /><StatCard title="Outstanding total" value={money(totalDue)} note="Unpaid balances" icon={<Wallet />} tone="rose" /></div><div className="panel report-panel"><h2>Fee obligations</h2><p>Outstanding balances by student</p>{store.students.map(s => { const due = store.fees.filter(f => f.studentId === s.id).reduce((sum, f) => sum + f.amount - f.paid, 0); return <div className="report-row" key={s.id}><span>{s.name}</span><div className="report-track"><i style={{ width: `${totalDue ? due / totalDue * 100 : 0}%` }} /></div><b>{money(due)}</b></div> })}</div></section>}
            </div></main>
        <nav className="bottom-nav">{navItems.map(([label, Icon]) => <button key={label} className={page === label ? 'active' : ''} onClick={() => setPage(label)}><Icon size={20} /><span>{label}</span></button>)}</nav>
        {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onClick={e => e.stopPropagation()} onSubmit={addStudent}><div className="modal-head"><div><span className="eyebrow">WELCOME A NEW ARTIST</span><h2>Add student</h2><p>Fill in the student and guardian details.</p></div><button type="button" className="icon-button" onClick={() => setShowAdd(false)}><X /></button></div><label>Student full name *<input required value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} placeholder="e.g. Riya Sharma" /></label><label>Guardian name *<input required value={studentForm.guardian} onChange={e => setStudentForm({ ...studentForm, guardian: e.target.value })} placeholder="Parent or guardian" /></label><label>Guardian phone *<input required inputMode="tel" value={studentForm.phone} onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })} placeholder="Country code + phone number" /></label><div className="form-split"><label>Class / group<select value={studentForm.group} onChange={e => setStudentForm({ ...studentForm, group: e.target.value })}><option>Class 4</option><option>Class 5</option><option>Class 6</option><option>Beginner</option><option>Advanced</option></select></label><label>Joining date<input type="date" required value={studentForm.joined} onChange={e => setStudentForm({ ...studentForm, joined: e.target.value })} /></label></div><div className="modal-actions"><button type="button" className="soft-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16} /> Save student</button></div></form></div>}
        {paying && <div className="modal-backdrop" onClick={() => setPaying(null)}><form className="modal compact-modal" onClick={e => e.stopPropagation()} onSubmit={collectPayment}><div className="modal-head"><div><span className="eyebrow">RECORD A TRANSACTION</span><h2>Collect fee</h2><p>{studentById(paying.studentId)?.name} · {paying.id}</p></div><button type="button" className="icon-button" onClick={() => setPaying(null)}><X /></button></div><div className="payment-due-box"><small>Remaining balance</small><b>{money(paying.amount - paying.paid)}</b></div><label>Amount received (₹)<input type="number" min="1" max={paying.amount - paying.paid} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required /></label><label>Payment method<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option>UPI</option><option>Cash</option><option>Bank Transfer</option></select></label><div className="modal-actions"><button type="button" className="soft-button" onClick={() => setPaying(null)}>Cancel</button><button type="submit" className="primary-btn"><Check size={16} /> Save payment</button></div></form></div>}
        {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal profile-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">STUDENT PROFILE</span><h2>{selected.name}</h2><p>{selected.id} · {selected.group}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X /></button></div><div className="profile-summary"><div className={`avatar large ${avatarTone(selected.id)}`}>{initials(selected.name)}</div><div><b>{selected.guardian}</b><small>Guardian · +{selected.phone}</small><small>Joined {shortDate(selected.joined)}</small></div></div><div className="profile-progress"><div><span>Fee cycle progress</span><b>{selected.progress}/4 Sundays</b></div><div className="progress-track"><i style={{ width: `${selected.progress * 25}%` }} /></div><small>Next fee: {selected.progress === 3 ? '₹200 after next attended class' : money(200)}</small></div><div className="profile-stats"><div><small>Total attended</small><b>{selected.totalAttended}</b></div><div><small>Outstanding</small><b>{money(store.fees.filter(f => f.studentId === selected.id).reduce((sum, f) => sum + f.amount - f.paid, 0))}</b></div></div><section className="student-attendance"><div className="student-pending-heading"><h3>Recent attendance</h3><span>{store.attendance.filter(a => a.studentId === selected.id).length}</span></div>{store.attendance.filter(a => a.studentId === selected.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(a => <div className="student-attendance-row" key={`${a.date}-${a.studentId}`}><span>{shortDate(a.date)}</span><span className={`status ${a.present ? 'status-active' : 'status-inactive'}`}>{a.present ? 'Present' : 'Absent'}</span></div>)}{!store.attendance.some(a => a.studentId === selected.id) && <p className="student-no-pending">No attendance has been recorded yet.</p>}</section><section className="student-pending-fees"><div className="student-pending-heading"><h3>Pending fees</h3><span>{store.fees.filter(f => f.studentId === selected.id && f.paid < f.amount).length}</span></div>{store.fees.filter(f => f.studentId === selected.id && f.paid < f.amount).sort((a, b) => b.created.localeCompare(a.created)).map(f => <div className="student-fee-row" key={f.id}><div><b>Fee cycle {f.cycle}</b><small>{shortDate(f.created)}</small></div><div className="student-fee-balance"><b>{money(f.amount - f.paid)}</b><span className={`status ${f.paid ? 'status-partial' : 'status-due'}`}>{f.paid ? 'Partially paid' : 'Unpaid'}</span></div></div>)}{!store.fees.some(f => f.studentId === selected.id && f.paid < f.amount) && <p className="student-no-pending">No pending fees.</p>}</section><div className="modal-actions"><button className="soft-button" onClick={() => whatsapp(selected)}> <MessageCircle size={16} /> WhatsApp</button><button className="primary-btn" onClick={() => { setSelected(null); setPage('Attendance') }}><CalendarCheck size={16} /> Attendance</button></div></div></div>}
        {toast && <div className="toast"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
    </>
}
function initials(name: string) { return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(); }
function avatarTone(id: string) { const n = Number(id.replace(/\D/g, '')) || 0; return ['av-lilac', 'av-mint', 'av-peach', 'av-blue', 'av-rose'][n % 5]; }
function progressColor(n: number) { return n === 3 ? '#f5a45c' : n === 2 ? '#5b5cf0' : n === 1 ? '#25b58b' : '#d7dbea'; }
function StatCard({ title, value, note, icon, tone }: { title: string; value: string; note: string; icon: React.ReactNode; tone: string }) { return <div className={`stat-card ${tone}`}><div className="stat-top"><div className="stat-icon">{icon}</div><span className="stat-more"><MoreHorizontal size={17} /></span></div><small>{title}</small><strong>{value}</strong><div className="stat-note">{note}</div></div> }
function PageHeading({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: React.ReactNode }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div> }
function Empty({ text }: { text: string }) { return <div className="empty-state"><div><Sparkles size={22} /></div><b>Nothing here yet</b><p>{text}</p></div> }
