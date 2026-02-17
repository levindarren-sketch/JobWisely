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
      
      {/* 1. ORIGINAL GRADIENT BACKGROUND */}
      <div className={`fixed inset-0 bg-gradient-to-tr ${theme.bg} via-[#0A0A0B] to-[#0A0A0B] opacity-50 transition-all duration-1000 pointer-events-none`} />

      {/* 2. SPLASH SCREEN */}
      {showSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0B] animate-out fade-out duration-700 delay-[2000ms] pointer-events-none">
           <div className="flex flex-col items-center animate-in zoom-in duration-1000">
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl mb-6 shadow-2xl">
                 <Sparkles size={64} className="text-blue-400 animate-pulse" />
              </div>
              <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">JobWisely</h1>
           </div>
        </div>
      )}

      {/* 3. SIDEBAR */}
      <aside className={`bg-[#0A0A0B]/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden relative z-20`}>
        <div className="p-6 flex items-center gap-3 font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"><Sparkles size={18} className="text-white"/></div>
          JobWisely
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setMode('selection')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-sm font-medium text-gray-400 hover:text-white transition-colors"><Plus size={18}/> New Session</button>
          <div className="h-px bg-white/5 my-4 mx-2" />
          {[
            { id: 'spy', label: 'Job Scout', icon: Search, color: 'text-purple-400' },
            { id: 'resume', label: 'Resume Builder', icon: FileText, color: 'text-pink-400' },
            { id: 'review', label: 'CV Review', icon: Briefcase, color: 'text-emerald-400' },
            { id: 'cover', label: 'Cover Letter', icon: PenTool, color: 'text-orange-400' }
          ].map((item) => (
             <button key={item.id} onClick={() => setMode(item.id as AppMode)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm transition-all ${mode === item.id ? 'bg-white/10 text-white font-bold shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>
               <item.icon size={18} className={mode === item.id ? item.color : ''} /> {item.label}
             </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
           {user ? (
             <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="truncate text-xs font-medium pr-2">{user.email}</div>
                <button onClick={() => signOut(auth)} className="hover:text-red-400 transition-colors"><LogOut size={16}/></button>
             </div>
           ) : (
             <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors">Sign In</button>
           )}
        </div>
      </aside>

      {/* 4. MAIN AREA */}
      <main className="flex-1 flex flex-col relative z-10">
        <header className="h-16 flex items-center justify-between px-6 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Menu size={20}/></button>
          
          {/* RESTORED SAVE BUTTON */}
          {user && currentData.messages.length > 0 && (
              <button 
                onClick={handleSaveSession} 
                disabled={saveStatus === 'saved' || saveStatus === 'saving'}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${saveStatus === 'saved' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
              >
                {saveStatus === 'saving' ? <Loader2 size={14} className="animate-spin"/> : saveStatus === 'saved' ? <Check size={14}/> : <Save size={14}/>}
                {saveStatus === 'saved' ? 'Saved' : 'Save Session'}
              </button>
          )}
        </header>

        {/* --- SCOUT INPUTS --- */}
        {mode === 'spy' && (
          <div className="px-6 mb-2 animate-in slide-in-from-top-4 duration-500 z-20">
            <div className="max-w-3xl mx-auto flex gap-3">
               <div className="flex-1 bg-[#1A1A1C] border border-white/10 rounded-xl flex items-center px-4 py-3 shadow-xl">
                  <MapPin size={16} className="text-purple-400 mr-3" />
                  <input 
                    className="bg-transparent outline-none text-sm w-full placeholder:text-gray-600" 
                    placeholder="Target Location (e.g. New York, Remote)..."
                    value={toolState.spy.location} 
                    onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, location: e.target.value } }))}
                  />
               </div>
               <select 
                 className="bg-[#1A1A1C] border border-white/10 rounded-xl px-4 text-sm outline-none cursor-pointer hover:border-white/20 transition-colors shadow-xl"
                 value={toolState.spy.hours}
                 onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, hours: e.target.value } }))}
               >
                 <option>Full-Time</option><option>Part-Time</option><option>Remote</option><option>Contract</option>
               </select>
            </div>
          </div>
        )}

        {/* CHAT AREA (FIXED TYPESCRIPT ERROR) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="max-w-3xl mx-auto space-y-6 pb-32">
            {currentData.messages.length === 0 && (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50">
                 <Sparkles size={48} className={`mb-6 ${theme.icon}`} />
                 <h2 className="text-3xl font-bold tracking-tight mb-2">How can I help you?</h2>
              </div>
            )}
            {currentData.messages.map((msg, i) => (
               <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"><Sparkles size={14}/></div>}
                  <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#1A1A1C] border border-white/5 text-gray-300'}`}>
                     {/* FIXED: Removed className from ReactMarkdown and put it on a parent div */}
                     <div className="prose prose-invert prose-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                     </div>
                  </div>
               </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT BAR */}
        <div className="p-6 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B] to-transparent z-20">
           <div className="max-w-3xl mx-auto bg-[#1A1A1C] border border-white/10 rounded-2xl p-2 flex items-end gap-2 shadow-2xl ring-1 ring-white/5 focus-within:ring-blue-500/50 transition-all">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-white transition-colors"><UploadCloud size={20}/></button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => e.target.files && setToolState(p => ({ ...p, [mode === 'selection' ? 'spy' : mode]: { ...p[mode === 'selection' ? 'spy' : mode], files: Array.from(e.target.files!) } }))} />
              
              <textarea 
                className="flex-1 bg-transparent p-3 outline-none resize-none text-sm min-h-[48px] max-h-32"
                placeholder="Ask JobWisely..."
                value={mode === 'spy' ? currentData.input : currentData.spec}
                onChange={e => mode === 'spy' ? setToolState(p => ({ ...p, spy: { ...p.spy, input: e.target.value } })) : setToolState(p => ({ ...p, [mode]: { ...p[mode], spec: e.target.value } }))}
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIAction(); } }}
              />
              
              <button onClick={handleAIAction} disabled={loading} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                 {loading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
              </button>
           </div>
           
           {currentData.files.length > 0 && (
              <div className="max-w-3xl mx-auto mt-2 flex gap-2 overflow-x-auto">
                 {currentData.files.map((f, i) => (
                    <div key={i} className="text-xs bg-white/5 px-2 py-1 rounded border border-white/10 flex items-center gap-2">
                       <FileText size={10} /> {f.name} <button onClick={() => setToolState(p => ({ ...p, [mode]: { ...p[mode], files: p[mode].files.filter((_, x) => x !== i) } }))}><X size={10}/></button>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </main>
    </div>
  );
}