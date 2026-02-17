"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Search, FileText, UploadCloud, 
  Briefcase, PenTool, Check, Copy, X, 
  Globe, Plus, Send, Menu, Sparkles, MapPin, LogIn, LogOut, Loader2, Save, History 
} from 'lucide-react';

// --- 1. FIREBASE SETUP ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPoOIOT9m5wORLAjSZI9VH1LS8-4dPVM4",
  authDomain: "aipal-e3f3c.firebaseapp.com",
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
interface Message { role: 'user' | 'assistant'; content: string; id: string; }
interface ToolData { input: string; spec: string; files: File[]; messages: Message[]; location?: string; hours?: string; }

// --- 3. YOUR ORIGINAL THEMES (Restored) ---
const THEMES: Record<AppMode, { bg: string; icon: string }> = {
  selection: { bg: 'from-blue-600/20', icon: 'text-blue-400' },
  spy: { bg: 'from-purple-600/20', icon: 'text-purple-400' },
  resume: { bg: 'from-pink-600/20', icon: 'text-pink-400' },
  review: { bg: 'from-emerald-600/20', icon: 'text-emerald-400' },
  cover: { bg: 'from-orange-600/20', icon: 'text-orange-400' }
};

export default function Home() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toolState, setToolState] = useState<Record<AppMode, ToolData>>({
    selection: { input: '', spec: '', files: [], messages: [] },
    spy: { input: '', spec: '', files: [], messages: [], location: '', hours: 'Full-Time' },
    resume: { input: '', spec: '', files: [], messages: [] },
    review: { input: '', spec: '', files: [], messages: [] },
    cover: { input: '', spec: '', files: [], messages: [] }
  });

  const currentData = toolState[mode] || toolState['selection'];
  const theme = THEMES[mode] || THEMES['selection'];

  // --- 4. EFFECTS ---
  useEffect(() => { setTimeout(() => setShowSplash(false), 2500); }, []);
  useEffect(() => { return onAuthStateChanged(auth, (u) => setUser(u)); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [toolState, loading]);

  // --- 5. ACTIONS ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSaveSession = async () => {
    if (!user) return alert("Please sign in to save.");
    if (currentData.messages.length === 0) return;

    setSaveStatus('saving');
    try {
      const docRef = doc(collection(db, "users", user.uid, "history"));
      await setDoc(docRef, {
        mode: mode,
        messages: currentData.messages,
        timestamp: serverTimestamp(),
        preview: currentData.messages[currentData.messages.length - 1].content.substring(0, 100)
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus('idle');
      alert("Failed to save session. Check console.");
    }
  };

  const handleAIAction = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setSaveStatus('idle'); 
    
    const m = mode === 'selection' ? 'spy' : mode;
    const txt = m === 'spy' ? toolState[m].input : toolState[m].spec;

    // --- Inject Location/Hours into the request ---
    const fd = new FormData();
    fd.append('mode', m);
    fd.append('text', txt);
    fd.append('language', 'English');
    fd.append('location', toolState['spy'].location || '');
    fd.append('hours', toolState['spy'].hours || '');
    
    for (const f of toolState[m].files) { fd.append('image', await fileToBase64(f)); }

    setToolState(p => ({
      ...p, [m]: { ...p[m], messages: [...p[m].messages, { role: 'user', content: txt, id: Math.random().toString() }, { role: 'assistant', content: '', id: 'ai-temp' }], input: '', spec: '' }
    }));

    try {
      const res = await fetch('/api/career', { method: 'POST', body: fd });
      if (!res.ok) throw new Error("API Error");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        acc += decoder.decode(value);
        setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: acc };
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } catch (err) { 
        console.error(err);
        setToolState(p => {
            const msgs = [...p[m].messages];
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "**Error:** Failed to reach JobWisely. Please check your connection." };
            return { ...p, [m]: { ...p[m], messages: msgs } };
        }); 
    } finally { setLoading(false); }
  }, [mode, toolState, loading]);

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* 1. ORIGINAL CINEMATIC BACKGROUND */}
      <div className={`fixed inset-0 bg-gradient-to-tr ${theme.bg} via-[#0A0A0B] to-[#0A0A0B] opacity-50 transition-all duration-1000 pointer-events-none`} />

      {/* 2. SPLASH SCREEN - ORIGINAL BLUR STYLE */}
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

      {/* 3. SIDEBAR - ORIGINAL DARK GREY (#121214) */}
      <aside className={`bg-[#121214] flex flex-col transition-all duration-300 relative z-20 border-r border-white/5 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden`}>
        <div className="p-8 flex items-center gap-3 text-white font-bold min-w-max">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><Sparkles size={20} className="text-white"/></div>
          <span className="text-xl tracking-tight">JobWisely</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 min-w-max">
          <button onClick={() => setMode('selection')} className="w-full flex items-center gap-3 p-3.5 hover:bg-white/5 rounded-xl text-sm font-bold text-gray-300 mb-6 transition-colors border border-transparent hover:border-white/5">
             <Plus size={18} /> New Session
          </button>
          
          {[
            { id: 'spy', label: 'Job Scout', icon: Search, color: 'text-purple-400' },
            { id: 'resume', label: 'Resume Builder', icon: FileText, color: 'text-pink-400' },
            { id: 'review', label: 'CV Review', icon: Briefcase, color: 'text-emerald-400' },
            { id: 'cover', label: 'Cover Letter', icon: PenTool, color: 'text-orange-400' }
          ].map((item) => (
             <button key={item.id} onClick={() => setMode(item.id as AppMode)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-sm transition-all ${mode === item.id ? 'bg-white/10 text-white font-bold border border-white/10' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}>
               <item.icon size={18} className={mode === item.id ? item.color : ''} /> {item.label}
             </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 min-w-max">
           {user ? (
             <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="truncate text-xs font-medium pr-2 text-gray-300">{user.email}</div>
                <button onClick={() => signOut(auth)} className="hover:text-red-400 transition-colors"><LogOut size={16}/></button>
             </div>
           ) : (
             <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors shadow-lg shadow-white/5">Sign In</button>
           )}
        </div>
      </aside>

      {/* 4. MAIN AREA */}
      <main className="flex-1 flex flex-col relative z-10">
        <header className="h-20 flex items-center justify-between px-8 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"><Menu size={22}/></button>
          
          {/* RESTORED SAVE BUTTON */}
          {user && currentData.messages.length > 0 && (
              <button 
                onClick={handleSaveSession} 
                disabled={saveStatus === 'saved' || saveStatus === 'saving'}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg ${saveStatus === 'saved' ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50' : 'bg-[#121214] hover:bg-white/10 border border-white/10'}`}
              >
                {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin"/> : saveStatus === 'saved' ? <Check size={16}/> : <Save size={16}/>}
                {saveStatus === 'saved' ? 'Saved' : 'Save Session'}
              </button>
          )}
        </header>

        {/* --- SCOUT INPUTS (Original Dark Style) --- */}
        {mode === 'spy' && (
          <div className="px-8 mb-4 animate-in slide-in-from-top-4 duration-500 z-20">
            <div className="max-w-3xl mx-auto flex gap-3">
               <div className="flex-1 bg-[#121214] border border-white/10 rounded-2xl flex items-center px-5 py-4 shadow-xl">
                  <MapPin size={18} className="text-purple-400 mr-3" />
                  <input 
                    className="bg-transparent outline-none text-sm w-full placeholder:text-gray-600 text-white" 
                    placeholder="Target Location (e.g. New York, Remote)..."
                    value={toolState.spy.location} 
                    onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, location: e.target.value } }))}
                  />
               </div>
               <select 
                 className="bg-[#121214] border border-white/10 rounded-2xl px-5 text-sm outline-none cursor-pointer hover:border-white/20 transition-colors shadow-xl text-white appearance-none"
                 value={toolState.spy.hours}
                 onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, hours: e.target.value } }))}
               >
                 <option>Full-Time</option><option>Part-Time</option><option>Remote</option><option>Contract</option>
               </select>
            </div>
          </div>
        )}

        {/* CHAT AREA (Original Round Bubbles & Spacing) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
          <div className="max-w-3xl mx-auto space-y-8 pb-36">
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
            
            {currentData.messages.map((msg, i) => (
               <div key={i} className={`flex gap-5 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                      <div className="w-10 h-10 rounded-2xl bg-[#121214] border border-white/5 flex items-center justify-center shrink-0 shadow-lg">
                          <Sparkles size={18} className={theme.icon}/>
                      </div>
                  )}
                  <div className={`max-w-[85%] px-6 py-5 rounded-[2rem] shadow-2xl ${msg.role === 'user' ? 'bg-[#121214] border border-white/10 text-white rounded-tr-sm' : 'text-gray-200 leading-relaxed'}`}>
                     {/* FIXED TYPESCRIPT ERROR: WRAPPED IN DIV */}
                     <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                     </div>
                  </div>
               </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT BAR (Original Pill Shape & Dark Grey) */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B] to-transparent z-20">
           <div className="max-w-3xl mx-auto bg-[#121214] border border-white/10 rounded-[2.5rem] p-2 pl-6 shadow-2xl flex items-end gap-3 transition-all focus-within:ring-1 focus-within:ring-blue-500/30">
              <button onClick={() => fileInputRef.current?.click()} className="pb-3.5 text-gray-500 hover:text-white transition-colors"><UploadCloud size={24}/></button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => e.target.files && setToolState(p => ({ ...p, [mode === 'selection' ? 'spy' : mode]: { ...p[mode === 'selection' ? 'spy' : mode], files: Array.from(e.target.files!) } }))} />
              
              <textarea 
                className="flex-1 bg-transparent py-4 outline-none resize-none text-lg text-white placeholder:text-gray-600 min-h-[56px] max-h-32"
                placeholder="Ask JobWisely..."
                value={mode === 'spy' ? currentData.input : currentData.spec}
                onChange={e => mode === 'spy' ? setToolState(p => ({ ...p, spy: { ...p.spy, input: e.target.value } })) : setToolState(p => ({ ...p, [mode]: { ...p[mode], spec: e.target.value } }))}
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIAction(); } }}
              />
              
              <button onClick={handleAIAction} disabled={loading} className="m-2 w-12 h-12 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                 {loading ? <Loader2 size={22} className="animate-spin text-white/50"/> : <Send size={24} className="ml-0.5"/>}
              </button>
           </div>
           
           {currentData.files.length > 0 && (
              <div className="max-w-3xl mx-auto mt-3 flex gap-2 overflow-x-auto px-2">
                 {currentData.files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#1c1c1f] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 animate-in zoom-in">
                       <FileText size={12} className="text-blue-400"/>
                       <span className="truncate max-w-[150px]">{f.name}</span>
                       <button onClick={() => setToolState(p => ({ ...p, [mode]: { ...p[mode], files: p[mode].files.filter((_, x) => x !== i) } }))} className="ml-1 hover:text-red-400"><X size={12}/></button>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </main>
    </div>
  );
}