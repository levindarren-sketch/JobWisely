// Deploy Fix 1
'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Search, FileText, UploadCloud, 
  Briefcase, PenTool, Check, Copy, X, 
  Globe, Plus, Send, Menu, Sparkles, Square, MapPin, LogIn, ArrowRight, Loader2, LogOut, History, Linkedin, ExternalLink, Octagon, Zap, Download, FileType
} from 'lucide-react';

// --- 1. FIREBASE INITIALIZATION ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User 
} from "firebase/auth";
import { 
  getFirestore, doc, setDoc, getDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPoOIOT9m5wORLAjSZI9VH1LS8-4dPVM4",
  authDomain: "jobwisely.com", 
  projectId: "aipal-e3f3c",
  storageBucket: "aipal-e3f3c.firebasestorage.app",
  messagingSenderId: "1054476809220",
  appId: "1:1054476809220:web:a018a529bab0a18fd47151",
  measurementId: "G-6J3GNF0FKB"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. TYPES & THEMES ---
type AppMode = 'selection' | 'spy' | 'resume' | 'review' | 'cover';
type LanguageKey = 'English' | 'Spanish' | 'French' | 'German' | 'Portuguese' | 'Italian' | 'Chinese' | 'Japanese' | 'Russian' | 'Arabic';

interface Message { role: 'user' | 'assistant'; content: string; id: string; isStopped?: boolean; }
interface ToolData { input: string; spec: string; files: File[]; messages: Message[]; location?: string; hours?: string; }

const THEMES: Record<AppMode, { bg: string; icon: string }> = {
  selection: { bg: 'from-blue-500/10', icon: 'text-blue-400' },
  spy: { bg: 'from-purple-500/10', icon: 'text-purple-400' },
  resume: { bg: 'from-pink-500/10', icon: 'text-pink-400' },
  review: { bg: 'from-emerald-500/10', icon: 'text-emerald-400' },
  cover: { bg: 'from-orange-500/10', icon: 'text-orange-400' }
};

interface LanguageStrings {
  hubTitle: string; spy: string; spyDesc: string;
  resBuilder: string; resDesc: string; review: string; revDesc: string;
  cover: string; covDesc: string; selectionDesc: string;
  waiting: string; waitingSpy: string; waitingResume: string; waitingReview: string; waitingCover: string;
  reset: string; stopped: string; welcome: string; loginPrompt: string; googleLogin: string;
}

// Fixed: Added all required language keys to satisfy the Record type
const baseEn: LanguageStrings = { 
  hubTitle: "JobWisely", spy: "Job Scout", spyDesc: "Find Jobs", 
  resBuilder: "Resume Builder", resDesc: "Upload your CV and paste the job description to rebuild it.", 
  review: "CV Review", revDesc: "Upload your CV and the job specs to find gaps.", 
  cover: "Cover Letter", covDesc: "Paste the job description and your details to draft it.", 
  selectionDesc: "Select a tool from the sidebar to begin.", 
  waiting: "How can I help you today?", 
  waitingSpy: "Ready to scout. What's the target?", 
  waitingResume: "Ready to build. Paste your CV below.", 
  waitingReview: "Ready to analyze. What's the job?", 
  waitingCover: "Ready to write. Who's the employer?", 
  reset: "New Session", stopped: "You stopped this generation", 
  welcome: "Welcome Back", loginPrompt: "Sign in to save your career progress", googleLogin: "Continue with Google"
};

const translations: Record<LanguageKey, LanguageStrings> = {
  English: baseEn, Spanish: baseEn, French: baseEn, German: baseEn, Portuguese: baseEn, 
  Italian: baseEn, Chinese: baseEn, Japanese: baseEn, Russian: baseEn, Arabic: baseEn
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
);

export default function Home() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [language, setLanguage] = useState<LanguageKey>('English');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [toolState, setToolState] = useState<Record<AppMode, ToolData>>({
    selection: { input: '', spec: '', files: [], messages: [] },
    spy: { input: '', spec: '', files: [], messages: [] },
    resume: { input: '', spec: '', files: [], messages: [] },
    review: { input: '', spec: '', files: [], messages: [] },
    cover: { input: '', spec: '', files: [], messages: [] }
  });

  const currentData = toolState[mode];
  const t = translations[language] || translations['English'];
  const theme = THEMES[mode];

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { console.error(err); }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  const handleAIAction = useCallback(async () => {
    if (loading) return;
    const m = mode;
    const txt = m === 'spy' ? toolState[m].input : toolState[m].spec;
    if (!txt.trim() && toolState[m].files.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setToolState(p => ({
      ...p,
      [m]: {
        ...p[m],
        messages: [...p[m].messages, 
          { role: 'user', content: txt, id: Math.random().toString() },
          { role: 'assistant', content: '', id: Math.random().toString() }
        ],
        input: '', spec: ''
      }
    }));
    setLoading(true);

    try {
      const res = await fetch('/api/career', { 
        method: 'POST', 
        body: JSON.stringify({ text: txt, mode: m }),
        signal: controller.signal 
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value);
        setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1].content = acc;
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1].isStopped = true;
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } finally { setLoading(false); abortControllerRef.current = null; }
  }, [toolState, mode, loading]);

  const currentGreeting = useMemo(() => t[`waiting${mode === 'selection' ? '' : mode.charAt(0).toUpperCase() + mode.slice(1)}` as keyof LanguageStrings], [mode, t]);
  const currentTutorial = useMemo(() => t[`${mode}Desc` as keyof LanguageStrings] || t.selectionDesc, [mode, t]);

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden">
      <div className={`fixed inset-0 bg-gradient-to-b ${theme.bg} to-transparent opacity-30 pointer-events-none transition-all duration-1000`} />
      
      {showSplash && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#131314] animate-out fade-out duration-700 delay-[1500ms] pointer-events-none">
           <div className="flex flex-col items-center">
              <div className="mb-8 p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-2xl animate-in zoom-in duration-1000">
                 <Sparkles size={72} className="text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">JobWisely</h1>
           </div>
        </div>
      )}

      <aside className={`bg-[#1e1f20] flex flex-col transition-all duration-300 z-20 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <div className="p-6 flex items-center gap-3 text-white font-bold">
          <Sparkles size={20} className="text-blue-400"/>
          <span className="text-lg">JobWisely</span>
        </div>
        <div className="flex-1 px-3 space-y-1">
          <button onClick={() => setMode('selection')} className="w-full flex items-center gap-3 p-3 hover:bg-[#333537] rounded-full text-sm font-bold text-white mb-4">
            <Plus size={18}/> {t.reset}
          </button>
          {[
            { id: 'spy', icon: <Search size={18}/>, label: t.spy },
            { id: 'resume', icon: <FileText size={18}/>, label: t.resBuilder },
            { id: 'review', icon: <Briefcase size={18}/>, label: t.review },
            { id: 'cover', icon: <PenTool size={18}/>, label: t.cover }
          ].map((item) => (
            <button key={item.id} onClick={() => setMode(item.id as AppMode)} className={`w-full flex items-center gap-3 p-3 rounded-full text-sm transition-all ${mode === item.id ? 'bg-[#333537] text-white font-bold' : 'text-[#c4c7c5] hover:bg-[#333537]'}`}>
              <span className={mode === item.id ? theme.icon : ''}>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-[#333537] rounded-full text-white"><Menu size={20}/></button>
          <div className="flex items-center gap-4">
            {!user ? (
              <button onClick={handleGoogleLogin} className="px-4 py-1.5 bg-[#333537] hover:bg-[#444648] rounded-full text-xs font-bold transition-all">Sign In</button>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-sm font-black text-white shadow-xl">ME</div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="max-w-3xl mx-auto px-6 pt-8 pb-60 space-y-12">
            {currentData.messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-[#333537] flex items-center justify-center shrink-0"><Sparkles size={16} className={theme.icon}/></div>}
                <div className={`max-w-[85%] p-4 rounded-2xl relative ${msg.role === 'user' ? 'bg-[#28292a] rounded-tr-none' : ''}`}>
                  {msg.role === 'user' && <div className="absolute top-0 -right-2 w-0 h-0 border-t-[10px] border-t-[#28292a] border-r-[10px] border-r-transparent" />}
                  <div className="prose prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.isStopped && <div className="text-xs text-gray-500 mt-3 flex items-center gap-2 uppercase tracking-widest animate-pulse"><Octagon size={12}/> {t.stopped}</div>}
                </div>
              </div>
            ))}
            
            {currentData.messages.length === 0 && (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                    <div className="p-8 rounded-full mb-8 bg-white/5 animate-pulse"><Sparkles size={72} className={theme.icon}/></div>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter mb-2">{currentGreeting}</h3>
                    <p className="text-gray-400 text-lg italic">{currentTutorial}</p>
                </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#131314] via-[#131314]/90 to-transparent">
          <div className="max-w-3xl mx-auto bg-[#1e1f20] rounded-[2.5rem] border border-white/5 p-3 shadow-2xl relative">
             <div className="flex items-end gap-2 px-2">
               <button className="p-3 hover:bg-[#333537] text-gray-400 rounded-full transition-all shrink-0">
                  <UploadCloud size={24}/>
               </button>
               <textarea 
                  className="flex-1 bg-transparent py-3 px-2 outline-none resize-none text-base text-white placeholder:text-[#8e918f] max-h-48 min-h-[52px]"
                  placeholder={`Ask JobWisely...`}
                  value={mode === 'spy' ? currentData.input : currentData.spec}
                  onChange={e => {
                     const val = e.target.value;
                     setToolState(p => ({ ...p, [mode]: { ...p[mode], [mode === 'spy' ? 'input' : 'spec']: val } }));
                  }}
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIAction(); } }}
               />
               
               <button 
                  onClick={loading ? handleStop : handleAIAction} 
                  className={`w-12 h-12 rounded-full transition-all shrink-0 flex items-center justify-center
                    ${loading ? 'bg-transparent border border-blue-500/30' : 'text-blue-400 hover:bg-[#333537]'}`}
               >
                  {loading ? (
                    <div className="w-3 h-3 bg-white rounded-[1px] shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  ) : (
                    <Send size={28}/>
                  )}
               </button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}