"use client";

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
  authDomain: "aipal-e3f3c.firebaseapp.com", // Correct domain for auth
  projectId: "aipal-e3f3c",
  storageBucket: "aipal-e3f3c.firebasestorage.app",
  messagingSenderId: "1054476809220",
  appId: "1:1054476809220:web:a018a529bab0a18fd47151",
  measurementId: "G-6J3GNF0FKB"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- 2. TYPES ---
type AppMode = 'selection' | 'spy' | 'resume' | 'review' | 'cover';
type LanguageKey = 'English' | 'Spanish' | 'French' | 'German' | 'Portuguese' | 'Italian' | 'Chinese' | 'Japanese' | 'Russian' | 'Arabic';

interface Message { role: 'user' | 'assistant'; content: string; id: string; isStopped?: boolean; }
interface ToolData { input: string; spec: string; files: File[]; messages: Message[]; location?: string; hours?: string; }

// --- 3. THEMES & BRANDING ---
const THEMES: Record<AppMode, { bg: string; icon: string }> = {
  selection: { bg: 'from-blue-600/20', icon: 'text-blue-400' },
  spy: { bg: 'from-purple-600/20', icon: 'text-purple-400' },
  resume: { bg: 'from-pink-600/20', icon: 'text-pink-400' },
  review: { bg: 'from-emerald-600/20', icon: 'text-emerald-400' },
  cover: { bg: 'from-orange-600/20', icon: 'text-orange-400' }
};

export default function Home() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [language, setLanguage] = useState<LanguageKey>('English');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);

  const [toolState, setToolState] = useState<Record<AppMode, ToolData>>({
    selection: { input: '', spec: '', files: [], messages: [] },
    spy: { input: '', spec: '', files: [], messages: [], location: '', hours: 'Full-Time' },
    resume: { input: '', spec: '', files: [], messages: [] },
    review: { input: '', spec: '', files: [], messages: [] },
    cover: { input: '', spec: '', files: [], messages: [] }
  });

  const currentData = toolState[mode] || toolState['selection'];
  const theme = THEMES[mode] || THEMES['selection'];

  // --- LOGIC: SPLASH & AUTH ---
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolState]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleAIAction = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    // If we are in 'selection' mode, default to 'spy' logic or handle gracefully
    const m = mode === 'selection' ? 'spy' : mode;
    const txt = m === 'spy' ? toolState[m].input : toolState[m].spec;
    
    // Package Data for Backend
    const fd = new FormData();
    fd.append('mode', m);
    fd.append('language', language);
    fd.append('text', txt);
    // These lines ensure Location and Hours are sent to the AI
    fd.append('location', toolState['spy'].location || '');
    fd.append('hours', toolState['spy'].hours || '');

    // Add any files attached
    const filesToUpload = toolState[m].files;
    for (const f of filesToUpload) {
       fd.append('image', await fileToBase64(f));
    }

    // Update UI immediately (Optimistic UI)
    setToolState(p => ({
      ...p,
      [m]: {
        ...p[m],
        messages: [...p[m].messages, { role: 'user', content: txt, id: Math.random().toString() }, { role: 'assistant', content: '', id: 'ai-temp' }],
        input: '', // clear inputs
        spec: ''
      }
    }));

    try {
      const res = await fetch('/api/career', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Server error');
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      // Stream the response word by word
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        acc += decoder.decode(value);
        
        setToolState(p => {
          const msgs = [...p[m].messages];
          // Update the last message (the assistant's placeholder)
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: acc, id: 'ai-response' };
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } catch (err) {
      console.error(err);
      setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "**Error:** Failed to connect to JobWisely. Please check your connection or API Key.", id: 'error' };
          return { ...p, [m]: { ...p[m], messages: msgs } };
      });
    } finally {
      setLoading(false);
    }
  }, [mode, toolState, language, loading]);

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-[#e3e3e3] overflow-hidden font-sans">
      
      {/* 1. CINEMATIC BACKGROUND GRADIENT (Restored) */}
      <div className={`fixed inset-0 bg-gradient-to-tr ${theme.bg} via-transparent to-transparent opacity-40 transition-all duration-1000 pointer-events-none`} />

      {/* 2. SPLASH SCREEN ANIMATION (Restored & Rebranded) */}
      {showSplash && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0A0B] animate-out fade-out duration-1000 delay-[2000ms] fill-mode-forwards pointer-events-none">
           <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/40 via-purple-600/40 to-pink-600/40 rounded-full blur-[120px] animate-pulse" />
           </div>
           <div className="relative z-10 flex flex-col items-center">
              <div className="mb-8 p-6 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl animate-in zoom-in duration-1000">
                 <Sparkles size={80} className="text-white drop-shadow-[0_0_25px_rgba(59,130,246,0.8)]" />
              </div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-gray-500 tracking-tighter animate-in slide-in-from-bottom-8 duration-1000">
                JobWisely
              </h1>
           </div>
        </div>
      )}

      {/* 3. SIDEBAR NAVIGATION */}
      <aside className={`bg-[#121214] flex flex-col transition-all duration-300 relative z-20 border-r border-white/5 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden`}>
        <div className="p-8 flex items-center gap-3 text-white font-bold min-w-max">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><Sparkles size={20} className="text-white"/></div>
          <span className="text-xl tracking-tight">JobWisely</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 min-w-max">
          <button onClick={() => setMode('selection')} className="w-full flex items-center gap-3 p-3.5 hover:bg-white/5 rounded-xl text-sm font-bold text-gray-300 mb-6 transition-colors border border-transparent hover:border-white/5">
             <Plus size={18} /> New Session
          </button>

          <button onClick={() => setMode('spy')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm transition-all ${mode === 'spy' ? 'bg-white/10 text-white font-bold border border-white/10' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}>
            <Search size={18} className={mode === 'spy' ? 'text-purple-400' : ''}/> Job Scout
          </button>
          <button onClick={() => setMode('resume')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm transition-all ${mode === 'resume' ? 'bg-white/10 text-white font-bold border border-white/10' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}>
            <FileText size={18} className={mode === 'resume' ? 'text-pink-400' : ''}/> Resume Builder
          </button>
          <button onClick={() => setMode('review')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm transition-all ${mode === 'review' ? 'bg-white/10 text-white font-bold border border-white/10' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}>
            <Briefcase size={18} className={mode === 'review' ? 'text-emerald-400' : ''}/> CV Review
          </button>
          <button onClick={() => setMode('cover')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm transition-all ${mode === 'cover' ? 'bg-white/10 text-white font-bold border border-white/10' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}>
            <PenTool size={18} className={mode === 'cover' ? 'text-orange-400' : ''}/> Cover Letter
          </button>
        </nav>

        <div className="p-6 border-t border-white/5 min-w-max">
           <div className="flex items-center gap-2 bg-[#0A0A0B] rounded-lg px-3 py-2 border border-white/5">
              <Globe size={14} className="text-gray-500"/>
              <select value={language} onChange={e => setLanguage(e.target.value as LanguageKey)} className="bg-transparent text-xs text-gray-400 outline-none w-full cursor-pointer hover:text-white transition-colors">
                 <option value="English">English</option>
                 <option value="Spanish">Spanish</option>
                 <option value="French">French</option>
                 <option value="German">German</option>
                 <option value="Portuguese">Portuguese</option>
                 <option value="Chinese">Chinese</option>
                 <option value="Japanese">Japanese</option>
                 <option value="Russian">Russian</option>
                 <option value="Arabic">Arabic</option>
              </select>
           </div>
        </div>
      </aside>

      {/* 4. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 z-20">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Menu size={22}/></button>
          <div className="flex items-center gap-4">
            {user ? (
               <div className="flex items-center gap-4">
                 <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-white">{user.displayName}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                 </div>
                 <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all">
                   <LogOut size={14}/>
                 </button>
               </div>
            ) : (
               <button onClick={() => signInWithPopup(auth, googleProvider)} className="px-6 py-2.5 bg-white text-black font-bold rounded-full text-sm hover:bg-gray-200 active:scale-95 transition-all shadow-lg shadow-white/10">
                 Sign In
               </button>
            )}
          </div>
        </header>

        {/* RESTORED JOB SCOUT INPUTS (Location & Hours) */}
        {mode === 'spy' && (
          <div className="max-w-3xl mx-auto w-full px-6 flex flex-wrap gap-4 animate-in slide-in-from-top-4 duration-500 z-10 mb-4">
            <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-[#121214] border border-white/10 rounded-2xl px-5 py-4 shadow-xl">
              <MapPin size={18} className="text-purple-400" />
              <input 
                type="text" 
                placeholder="Target Location (e.g. London, Remote)" 
                className="bg-transparent outline-none text-sm w-full text-white placeholder:text-gray-600"
                value={toolState.spy.location}
                onChange={(e) => setToolState(p => ({ ...p, spy: { ...p.spy, location: e.target.value } }))}
              />
            </div>
            <div className="min-w-[160px] relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Briefcase size={18} className="text-blue-400" />
                </div>
                <select 
                className="w-full bg-[#121214] border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm text-white outline-none cursor-pointer appearance-none shadow-xl"
                value={toolState.spy.hours}
                onChange={(e) => setToolState(p => ({ ...p, spy: { ...p.spy, hours: e.target.value } }))}
                >
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Remote">Remote</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
                </select>
            </div>
          </div>
        )}

        {/* CHAT DISPLAY */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide z-10">
          <div className="max-w-3xl mx-auto space-y-8 pb-32">
            
            {/* Empty State / Welcome */}
            {currentData.messages.length === 0 && (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-700">
                <div className={`p-10 rounded-[2.5rem] mb-8 bg-gradient-to-b ${theme.bg} to-transparent shadow-2xl animate-pulse`}>
                  <Sparkles size={64} className={theme.icon}/>
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4">
                    How can I help you today?
                </h3>
                <p className="text-gray-500 font-medium text-lg">Select a tool from the sidebar to begin.</p>
              </div>
            )}

            {/* Message List */}
            {currentData.messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-5 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-2xl bg-[#121214] border border-white/5 flex items-center justify-center shrink-0 shadow-lg">
                        <Sparkles size={18} className={theme.icon}/>
                    </div>
                )}
                
                <div className={`max-w-[85%] rounded-[2rem] p-6 shadow-2xl relative ${msg.role === 'user' ? 'bg-[#121214] border border-white/10 text-white rounded-tr-sm' : 'text-gray-200 leading-relaxed'}`}>
                  {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                      <div className="prose prose-invert max-w-none prose-p:leading-7 prose-headings:text-white prose-strong:text-white prose-a:text-blue-400">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                  )}

                  {/* Copy Button for Assistant */}
                  {msg.role === 'assistant' && !loading && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                          <button onClick={() => copyText(msg.content, msg.id)} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-white transition-colors">
                              {copySuccessId === msg.id ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                              {copySuccessId === msg.id ? "Copied" : "Copy"}
                          </button>
                      </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* BOTTOM INPUT AREA */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B] to-transparent z-20">
          <div className="max-w-3xl mx-auto bg-[#121214] border border-white/10 rounded-[2.5rem] p-2 pl-6 shadow-2xl flex items-end gap-3 transition-all focus-within:border-blue-500/30 focus-within:shadow-blue-500/10">
             
             {/* File Upload Button */}
             <button onClick={() => fileInputRef.current?.click()} className="pb-3.5 text-gray-500 hover:text-white transition-colors">
                <UploadCloud size={24} />
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => {
                     if (e.target.files) {
                        setToolState(p => ({ ...p, [mode === 'selection' ? 'spy' : mode]: { ...p[mode === 'selection' ? 'spy' : mode], files: Array.from(e.target.files!) } }));
                     }
                  }}/>
             </button>

             <textarea 
                className="flex-1 bg-transparent py-4 outline-none resize-none text-lg text-white placeholder:text-gray-600 min-h-[56px] max-h-32"
                rows={1}
                placeholder={`Ask JobWisely...`}
                value={mode === 'spy' ? currentData.input : currentData.spec}
                onChange={(e) => {
                  if (mode === 'spy') setToolState(p => ({ ...p, spy: { ...p.spy, input: e.target.value } }));
                  else setToolState(p => ({ ...p, [mode]: { ...p[mode], spec: e.target.value } }));
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAIAction();
                    }
                }}
             />
             
             <button 
                onClick={handleAIAction}
                disabled={loading}
                className={`m-2 w-12 h-12 rounded-full flex items-center justify-center transition-all ${loading ? 'bg-white/5 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95'}`}
             >
                {loading ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <Send size={24} className="ml-0.5"/>}
             </button>
          </div>
          
          {/* File Preview */}
          {currentData.files.length > 0 && (
             <div className="max-w-3xl mx-auto mt-3 flex gap-2 overflow-x-auto px-2">
                {currentData.files.map((f, i) => (
                   <div key={i} className="flex items-center gap-2 bg-[#1c1c1f] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 animate-in zoom-in">
                      <FileText size={12} className="text-blue-400"/>
                      <span className="truncate max-w-[150px]">{f.name}</span>
                      <button onClick={() => setToolState(p => ({ ...p, [mode]: { ...p[mode], files: p[mode].files.filter((_, idx) => idx !== i) } }))} className="ml-1 hover:text-red-400"><X size={12}/></button>
                   </div>
                ))}
             </div>
          )}
          
          <div className="text-center mt-4">
             <p className="text-[10px] uppercase tracking-widest text-gray-700 font-bold">Powered by JobWisely Intelligence</p>
          </div>
        </div>
      </main>
    </div>
  );
}