'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Search, FileText, UploadCloud, 
  Briefcase, PenTool, Check, Copy, X, 
  Globe, Plus, Send, Menu, Sparkles, MapPin, Loader2, LogOut, History, Download, FileType, Octagon
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
type LanguageKey = 'English' | 'Spanish' | 'French' | 'German' | 'Portuguese' | 'Italian' | 'Chinese' | 'Japanese' | 'Russian' | 'Arabic';

interface Message { role: 'user' | 'assistant'; content: string; id: string; isStopped?: boolean; }
interface ToolData { input: string; spec: string; files: File[]; messages: Message[]; location?: string; hours?: string; }

interface LanguageStrings {
  hubTitle: string; back: string; spy: string; spyDesc: string;
  resBuilder: string; resDesc: string; review: string; revDesc: string;
  cover: string; covDesc: string; selectionDesc: string; uploadLabel: string; jobPlaceholder: string;
  detailsPlaceholder: string; result: string; copy: string; copied: string; 
  waiting: string; waitingSpy: string; waitingResume: string; waitingReview: string; waitingCover: string;
  reset: string; langNames: Record<LanguageKey, string>;
  generate: string; missionComplete: string; backgroundActive: string;
  fullTime: string; partTime: string; remote: string; 
  signIn: string; signOut: string; welcome: string;
  loginPrompt: string; googleLogin: string; loginLater: string; 
  loadSave: string; startFresh: string; resumeSession: string; sessionFound: string;
  stopped: string;
}

// --- 3. TRANSLATIONS ---
const translations: Record<LanguageKey, LanguageStrings> = {
  English: { 
    hubTitle: "JobWisely", back: "Back", spy: "Job Scout", spyDesc: "Find Jobs", 
    resBuilder: "Resume Builder", resDesc: "Rebuild your CV.", 
    review: "CV Review", revDesc: "Analyze your CV.", 
    cover: "Cover Letter", covDesc: "Draft a letter.", 
    selectionDesc: "Select a tool.", uploadLabel: "Upload", jobPlaceholder: "Paste job...", detailsPlaceholder: "Details...", result: "Result", copy: "Copy", copied: "Copied", 
    waiting: "How can I help you today?", 
    waitingSpy: "Ready to scout. What's the target?", 
    waitingResume: "Ready to build. Paste your CV below.", 
    waitingReview: "Ready to analyze. What's the job?", 
    waitingCover: "Ready to write. Who's the employer?", 
    reset: "New Session", generate: "Generate", missionComplete: "Saved", backgroundActive: "Saving...",
    fullTime: "Full-Time", partTime: "Part-Time", remote: "Remote", signIn: "Sign In", signOut: "Sign Out", welcome: "Welcome Back", loginPrompt: "Sign in to save your career progress", googleLogin: "Continue with Google", loginLater: "Sign in later", 
    loadSave: "Yes, Load Save", startFresh: "No, Start Fresh", resumeSession: "Resume Session?", sessionFound: "Load previous session?", stopped: "Stopped", langNames: { English: "English", Spanish: "Spanish", French: "French", German: "German", Portuguese: "Portuguese", Italian: "Italian", Chinese: "Chinese", Japanese: "Japanese", Russian: "Russian", Arabic: "Arabic" }
  },
  Spanish: { hubTitle: "JobWisely", back: "Volver", spy: "Buscador", spyDesc: "Buscar Trabajos", resBuilder: "Constructor", resDesc: "Rehacer CV.", review: "Revisión", revDesc: "Analizar CV.", cover: "Carta", covDesc: "Redactar carta.", selectionDesc: "Seleccione herramienta.", uploadLabel: "Subir", jobPlaceholder: "Puesto...", detailsPlaceholder: "Detalles...", result: "Resultado", copy: "Copia", copied: "Copiado", waiting: "¿Cómo ayudo?", waitingSpy: "Listo para buscar.", waitingResume: "Listo para construir.", waitingReview: "Listo para analizar.", waitingCover: "Listo para escribir.", reset: "Reiniciar", langNames: { English: "Inglés", Spanish: "Español", French: "Francés", German: "Alemán", Portuguese: "Portugués", Italian: "Italiano", Chinese: "Chino", Japanese: "Japonés", Russian: "Ruso", Arabic: "Árabe" }, generate: "Generar", missionComplete: "Guardado", backgroundActive: "Guardando...", fullTime: "Tiempo Completo", partTime: "Medio Tiempo", remote: "Remoto", signIn: "Entrar", signOut: "Salir", welcome: "Bienvenido", loginPrompt: "Inicia sesión", googleLogin: "Google", loginLater: "Luego", loadSave: "Cargar", startFresh: "Nuevo", resumeSession: "¿Reanudar?", sessionFound: "¿Cargar último?", stopped: "Detenido" },
  French: { hubTitle: "JobWisely", back: "Retour", spy: "Éclaireur", spyDesc: "Trouver Emplois", resBuilder: "Créateur", resDesc: "Refaire CV.", review: "Révision", revDesc: "Analyser CV.", cover: "Lettre", covDesc: "Rédiger lettre.", selectionDesc: "Outil.", uploadLabel: "Charger", jobPlaceholder: "Poste...", detailsPlaceholder: "Détails...", result: "Résultat", copy: "Copier", copied: "Copié", waiting: "Aide?", waitingSpy: "Prêt.", waitingResume: "Prêt.", waitingReview: "Prêt.", waitingCover: "Prêt.", reset: "Nouveau", langNames: { English: "Anglais", Spanish: "Espagnol", French: "Français", German: "Allemand", Portuguese: "Portugais", Italian: "Italien", Chinese: "Chinois", Japanese: "Japonés", Russian: "Russe", Arabic: "Arabe" }, generate: "Générer", missionComplete: "Enregistré", backgroundActive: "En cours...", fullTime: "Temps Plein", partTime: "Temps Partiel", remote: "Télétravail", signIn: "Connexion", signOut: "Déconnexion", welcome: "Bonjour", loginPrompt: "Connectez-vous", googleLogin: "Google", loginLater: "Plus tard", loadSave: "Oui", startFresh: "Non", resumeSession: "Reprendre?", sessionFound: "Charger?", stopped: "Arrêté" },
  German: { hubTitle: "JobWisely", back: "Zurück", spy: "Scout", spyDesc: "Jobs", resBuilder: "Builder", resDesc: "CV bauen.", review: "Check", revDesc: "CV prüfen.", cover: "Brief", covDesc: "Brief schreiben.", selectionDesc: "Tool wählen.", uploadLabel: "Upload", jobPlaceholder: "Job...", detailsPlaceholder: "Details...", result: "Ergebnis", copy: "Kopieren", copied: "Kopiert", waiting: "Hilfe?", waitingSpy: "Bereit.", waitingResume: "Bereit.", waitingReview: "Bereit.", waitingCover: "Bereit.", reset: "Neu", langNames: { English: "Englisch", Spanish: "Spanisch", French: "Französisch", German: "Deutsch", Portuguese: "Portugiesisch", Italian: "Italienisch", Chinese: "Chinesisch", Japanese: "Japanisch", Russian: "Russisch", Arabic: "Arabisch" }, generate: "Start", missionComplete: "Gespeichert", backgroundActive: "Speichert...", fullTime: "Vollzeit", partTime: "Teilzeit", remote: "Remote", signIn: "Login", signOut: "Logout", welcome: "Hallo", loginPrompt: "Anmelden", googleLogin: "Google", loginLater: "Später", loadSave: "Laden", startFresh: "Neu", resumeSession: "Laden?", sessionFound: "Laden?", stopped: "Stopp" },
  Portuguese: { hubTitle: "JobWisely", back: "Voltar", spy: "Scout", spyDesc: "Vagas", resBuilder: "Criador", resDesc: "Refazer CV.", review: "Revisão", revDesc: "Revisar CV.", cover: "Carta", covDesc: "Escrever carta.", selectionDesc: "Ferramenta.", uploadLabel: "Upload", jobPlaceholder: "Vaga...", detailsPlaceholder: "Detalhes...", result: "Resultado", copy: "Copiar", copied: "Copiado", waiting: "Ajuda?", waitingSpy: "Pronto.", waitingResume: "Pronto.", waitingReview: "Pronto.", waitingCover: "Pronto.", reset: "Novo", langNames: { English: "Inglês", Spanish: "Espanhol", French: "Francês", German: "Alemão", Portuguese: "Português", Italian: "Italiano", Chinese: "Chinês", Japanese: "Japonês", Russian: "Russo", Arabic: "Árabe" }, generate: "Gerar", missionComplete: "Salvo", backgroundActive: "Salvando...", fullTime: "Integral", partTime: "Meio", remote: "Remoto", signIn: "Entrar", signOut: "Sair", welcome: "Olá", loginPrompt: "Entrar", googleLogin: "Google", loginLater: "Depois", loadSave: "Sim", startFresh: "Não", resumeSession: "Retomar?", sessionFound: "Carregar?", stopped: "Parado" },
  Italian: { hubTitle: "JobWisely", back: "Indietro", spy: "Scout", spyDesc: "Lavoro", resBuilder: "Crea", resDesc: "Rifai CV.", review: "Revisione", revDesc: "Analisi CV.", cover: "Lettera", covDesc: "Scrivi lettera.", selectionDesc: "Strumento.", uploadLabel: "Carica", jobPlaceholder: "Lavoro...", detailsPlaceholder: "Dettagli...", result: "Risultato", copy: "Copia", copied: "Copiato", waiting: "Aiuto?", waitingSpy: "Pronto.", waitingResume: "Pronto.", waitingReview: "Pronto.", waitingCover: "Pronto.", reset: "Nuovo", langNames: { English: "Inglese", Spanish: "Spagnolo", French: "Francese", German: "Tedesco", Portuguese: "Portoghese", Italian: "Italiano", Chinese: "Cinese", Japanese: "Giapponese", Russian: "Russo", Arabic: "Arabo" }, generate: "Genera", missionComplete: "Salvato", backgroundActive: "Salvataggio...", fullTime: "Full", partTime: "Part", remote: "Remoto", signIn: "Login", signOut: "Logout", welcome: "Ciao", loginPrompt: "Accedi", googleLogin: "Google", loginLater: "Dopo", loadSave: "Sì", startFresh: "No", resumeSession: "Riprendere?", sessionFound: "Caricare?", stopped: "Stop" },
  Chinese: { hubTitle: "JobWisely", back: "返回", spy: "搜索", spyDesc: "找工作", resBuilder: "简历", resDesc: "重写简历", review: "评估", revDesc: "评估简历", cover: "求职信", covDesc: "写求职信", selectionDesc: "选择工具", uploadLabel: "上传", jobPlaceholder: "职位...", detailsPlaceholder: "详情...", result: "结果", copy: "复制", copied: "已复制", waiting: "需要帮助吗？", waitingSpy: "准备就绪", waitingResume: "准备就绪", waitingReview: "准备就绪", waitingCover: "准备就绪", reset: "重置", langNames: { English: "英语", Spanish: "西语", French: "法语", German: "德语", Portuguese: "葡语", Italian: "意语", Chinese: "中文", Japanese: "日语", Russian: "俄语", Arabic: "阿语" }, generate: "生成", missionComplete: "已保存", backgroundActive: "保存中...", fullTime: "全职", partTime: "兼职", remote: "远程", signIn: "登录", signOut: "退出", welcome: "欢迎", loginPrompt: "请登录", googleLogin: "Google登录", loginLater: "稍后", loadSave: "加载", startFresh: "新建", resumeSession: "恢复？", sessionFound: "加载存档？", stopped: "已停止" },
  Japanese: { hubTitle: "JobWisely", back: "戻る", spy: "スカウト", spyDesc: "求人検索", resBuilder: "履歴書", resDesc: "再作成", review: "レビュー", revDesc: "分析", cover: "手紙", covDesc: "作成", selectionDesc: "ツール選択", uploadLabel: "アップ", jobPlaceholder: "職種...", detailsPlaceholder: "詳細...", result: "結果", copy: "コピー", copied: "完了", waiting: "ご用件は？", waitingSpy: "準備完了", waitingResume: "準備完了", waitingReview: "準備完了", waitingCover: "準備完了", reset: "新規", langNames: { English: "英語", Spanish: "スペイン語", French: "フランス語", German: "ドイツ語", Portuguese: "ポルトガル語", Italian: "イタリア語", Chinese: "中国語", Japanese: "日本語", Russian: "ロシア語", Arabic: "アラビア語" }, generate: "生成", missionComplete: "保存済", backgroundActive: "保存中...", fullTime: "フル", partTime: "パート", remote: "リモート", signIn: "ログイン", signOut: "ログアウト", welcome: "ようこそ", loginPrompt: "ログインしてください", googleLogin: "Google", loginLater: "後で", loadSave: "ロード", startFresh: "新規", resumeSession: "再開？", sessionFound: "ロードしますか？", stopped: "停止" },
  Russian: { hubTitle: "JobWisely", back: "Назад", spy: "Поиск", spyDesc: "Вакансии", resBuilder: "Резюме", resDesc: "Создать", review: "Обзор", revDesc: "Анализ", cover: "Письмо", covDesc: "Написать", selectionDesc: "Инструмент", uploadLabel: "Файл", jobPlaceholder: "Работа...", detailsPlaceholder: "Детали...", result: "Итог", copy: "Копия", copied: "Готово", waiting: "Чем помочь?", waitingSpy: "Готов", waitingResume: "Готов", waitingReview: "Готов", waitingCover: "Готов", reset: "Сброс", langNames: { English: "Англ", Spanish: "Исп", French: "Франц", German: "Нем", Portuguese: "Порт", Italian: "Итал", Chinese: "Кит", Japanese: "Яп", Russian: "Рус", Arabic: "Араб" }, generate: "Пуск", missionComplete: "Сохранено", backgroundActive: "Сохранение...", fullTime: "Полный", partTime: "Частично", remote: "Удаленно", signIn: "Вход", signOut: "Выход", welcome: "Привет", loginPrompt: "Войдите", googleLogin: "Google", loginLater: "Позже", loadSave: "Да", startFresh: "Нет", resumeSession: "Продолжить?", sessionFound: "Загрузить?", stopped: "Стоп" },
  Arabic: { hubTitle: "JobWisely", back: "عودة", spy: "كشاف", spyDesc: "بحث", resBuilder: "سيرة", resDesc: "بناء", review: "مراجعة", revDesc: "تحليل", cover: "خطاب", covDesc: "كتابة", selectionDesc: "اختر", uploadLabel: "رفع", jobPlaceholder: "وظيفة...", detailsPlaceholder: "تفاصيل...", result: "نتيجة", copy: "نسخ", copied: "تم", waiting: "كيف أساعد؟", waitingSpy: "جاهز", waitingResume: "جاهز", waitingReview: "جاهز", waitingCover: "جاهز", reset: "جديد", langNames: { English: "إنجليزي", Spanish: "إسباني", French: "فرنسي", German: "ألماني", Portuguese: "برتغالي", Italian: "إيطالي", Chinese: "صيني", Japanese: "ياباني", Russian: "روسي", Arabic: "عربي" }, generate: "بدء", missionComplete: "حفظ", backgroundActive: "حفظ...", fullTime: "كامل", partTime: "جزئي", remote: "عن بعد", signIn: "دخول", signOut: "خروج", welcome: "مرحبا", loginPrompt: "سجل", googleLogin: "جوجل", loginLater: "لاحقا", loadSave: "نعم", startFresh: "لا", resumeSession: "استئناف؟", sessionFound: "تحميل؟", stopped: "توقف" }
};

const THEMES: Record<AppMode, { bg: string; icon: string }> = {
  selection: { bg: 'from-blue-500/10', icon: 'text-blue-400' },
  spy: { bg: 'from-purple-500/10', icon: 'text-purple-400' },
  resume: { bg: 'from-pink-500/10', icon: 'text-pink-400' },
  review: { bg: 'from-emerald-500/10', icon: 'text-emerald-400' },
  cover: { bg: 'from-orange-500/10', icon: 'text-orange-400' }
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function Home() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [language, setLanguage] = useState<LanguageKey>('English');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const [showSplash, setShowSplash] = useState(true); 
  const [user, setUser] = useState<User | null>(null); 
  const [showLoginModal, setShowLoginModal] = useState(false); 
  const [loginLoading, setLoginLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingData, setPendingData] = useState<Record<AppMode, ToolData> | null>(null); 
  const [showLoadPrompt, setShowLoadPrompt] = useState(false); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [toolState, setToolState] = useState<Record<AppMode, ToolData>>({
    selection: { input: '', spec: '', files: [], messages: [] },
    spy: { input: '', spec: '', files: [], messages: [], location: '', hours: 'Full-Time' },
    resume: { input: '', spec: '', files: [], messages: [] },
    review: { input: '', spec: '', files: [], messages: [] },
    cover: { input: '', spec: '', files: [], messages: [] }
  });

  const currentData = toolState[mode] || toolState['spy'];
  const t = useMemo(() => translations[language] || translations['English'], [language]);
  const theme = THEMES[mode] || THEMES['selection'];

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try { await signInWithPopup(auth, googleProvider); } catch (err: unknown) { console.error(err); }
    finally { setLoginLoading(false); }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  const handleRestore = () => {
    if(pendingData) setToolState(p => ({ ...p, ...pendingData }));
    setShowLoadPrompt(false);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleExport = async (text: string, format: 'pdf' | 'docx') => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, format }),
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobwisely-doc.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Export functionality requires an active backend route.");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const getInitials = () => user?.displayName ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "ME";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setShowLoginModal(false);
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setPendingData(docSnap.data() as Record<AppMode, ToolData>);
            setShowLoadPrompt(true);
          }
        } catch (err: unknown) { console.error("Sync Error:", err); }
      } else {
        setUser(null);
        if (!localStorage.getItem('skip_login')) setShowLoginModal(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || showLoadPrompt) return;
    setSaveStatus('saving');
    const tid = setTimeout(async () => {
      try {
        const clean = Object.fromEntries(Object.entries(toolState).map(([k, v]) => [k, { ...v, files: [] }]));
        await setDoc(doc(db, "users", user.uid), clean);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err: unknown) { setSaveStatus('error'); console.error(err); }
    }, 2000); 
    return () => clearTimeout(tid);
  }, [toolState, user, showLoadPrompt]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop <= clientHeight + 50;
  };

  useEffect(() => {
    if (autoScrollRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [toolState]);

  const handleAIAction = useCallback(async () => {
    if (loading) return;
    const m = mode;
    const txt = m === 'spy' ? toolState[m].input : toolState[m].spec;
    if (!txt.trim() && toolState[m].files.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setToolState(p => ({ ...p, [m]: { ...p[m], messages: [...p[m].messages, { role: 'user', content: txt, id: Math.random().toString() }, { role: 'assistant', content: '', id: Math.random().toString() }], input: '', spec: '' } }));
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('mode', m); fd.append('language', language);
      fd.append('text', txt);
      // SEND LOCATION AND HOURS FOR SCOUT MODE
      if (m === 'spy') {
          fd.append('location', toolState.spy.location || '');
          fd.append('hours', toolState.spy.hours || 'Full-Time');
      }
      
      for (const f of toolState[m].files) {
        fd.append('image', await fileToBase64(f)); 
      }
      const res = await fetch('/api/career', { method: 'POST', body: fd, signal: controller.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value);
        setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: acc };
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setToolState(p => {
          const msgs = [...p[m].messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStopped: true };
          return { ...p, [m]: { ...p[m], messages: msgs } };
        });
      }
    } finally { setLoading(false); abortControllerRef.current = null; }
  }, [toolState, language, mode, loading]);

  const currentGreeting = useMemo(() => String(t[mode === 'selection' ? 'waiting' : `waiting${mode.charAt(0).toUpperCase() + mode.slice(1)}` as keyof LanguageStrings]), [mode, t]);
  const currentTutorial = useMemo(() => {
    const mapping: Record<string, keyof LanguageStrings> = {
      selection: 'selectionDesc', spy: 'spyDesc', resume: 'resDesc', review: 'revDesc', cover: 'covDesc'
    };
    return String(t[mapping[mode] || 'selectionDesc']);
  }, [mode, t]);

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden" dir={language === 'Arabic' ? 'rtl' : 'ltr'}>
      <div className={`fixed inset-0 bg-gradient-to-b ${theme.bg} to-transparent opacity-30 pointer-events-none transition-all duration-1000`} />
      
      {/* SPLASH */}
      {showSplash && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#131314] animate-out fade-out duration-700 delay-[2000ms] fill-mode-forwards pointer-events-none">
           <div className="relative z-10 flex flex-col items-center">
              <div className="mb-8 p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-2xl animate-in zoom-in duration-1000">
                 <Sparkles size={72} className="text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
              </div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 tracking-tight animate-in slide-in-from-bottom-4 duration-1000">JobWisely</h1>
           </div>
        </div>
      )}

      {/* CLOUD RESTORE */}
      {showLoadPrompt && (
        <div className="fixed bottom-6 right-6 bg-[#1e1f20] border border-blue-500/30 p-5 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-5">
           <div className="flex items-start gap-4 mb-4">
              <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400 shrink-0"><History size={24} /></div>
              <div><h4 className="font-bold text-white mb-1">{t.resumeSession}</h4><p className="text-xs text-gray-400">{t.sessionFound}</p></div>
           </div>
           <div className="flex gap-2">
              <button onClick={handleRestore} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95">{t.loadSave}</button>
              <button onClick={() => setShowLoadPrompt(false)} className="flex-1 bg-[#28292a] hover:bg-[#333537] text-gray-400 hover:text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95">{t.startFresh}</button>
           </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && !showSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-[#1e1f20] w-full max-w-md p-8 rounded-3xl border border-white/10 text-center relative animate-in zoom-in-95 duration-300">
            {loginLoading ? <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto py-12" /> : (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-pink-500 mx-auto mb-6 flex items-center justify-center shadow-lg"><Sparkles className="text-white w-8 h-8" /></div>
                <h2 className="text-3xl font-black text-white mb-2 italic tracking-tight">{t.welcome}</h2>
                <p className="text-gray-400 mb-8 text-sm">{t.loginPrompt}</p>
                <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all"><GoogleIcon /> {t.googleLogin}</button>
                <button onClick={() => { localStorage.setItem('skip_login', 'true'); setShowLoginModal(false); }} className="mt-6 text-xs text-gray-500 hover:text-white underline transition-colors">{t.loginLater}</button>
              </>
            )}
          </div>
        </div>
      )}

      <aside className={`bg-[#1e1f20] flex flex-col transition-all duration-300 relative z-20 overflow-hidden ${sidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
        <div className="p-6 flex items-center gap-3 text-white font-bold"><div className="bg-blue-600 p-1.5 rounded-lg"><Sparkles size={18}/></div><span className="text-lg">JobWisely</span></div>
        <div className="flex-1 px-3 space-y-1">
          <button onClick={() => setMode('selection')} className="w-full flex items-center gap-3 p-3 hover:bg-[#333537] rounded-full text-sm font-bold text-white mb-4"><Plus size={18}/> {t.reset}</button>
          {[ { id: 'spy', icon: <Search size={18}/>, label: t.spy }, { id: 'resume', icon: <FileText size={18}/>, label: t.resBuilder }, { id: 'review', icon: <Briefcase size={18}/>, label: t.review }, { id: 'cover', icon: <PenTool size={18}/>, label: t.cover } ].map((item) => (
            <button key={item.id} onClick={() => setMode(item.id as AppMode)} className={`w-full flex items-center gap-3 p-3 rounded-full text-sm transition-all ${mode === item.id ? 'bg-[#333537] text-white font-bold' : 'text-[#c4c7c5] hover:bg-[#333537]'}`}>
              <span className={mode === item.id ? theme.icon : ''}>{item.icon}</span> <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5">
           <div className="flex items-center gap-2 bg-[#333537] rounded-full px-3 py-2">
              <Globe size={14} className="text-gray-400"/>
              <select value={language} onChange={e => setLanguage(e.target.value as LanguageKey)} className="bg-transparent text-xs text-gray-200 outline-none w-full cursor-pointer">
                 {Object.keys(translations).map(k => <option key={k} value={k} className="bg-[#1e1f20]">{translations[k as LanguageKey].langNames[language]}</option>)}
              </select>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-[#333537] rounded-full text-white transition-colors"><Menu size={20}/></button>
          <div className="flex items-center gap-4 relative">
             {saveStatus === 'saving' && <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> {t.backgroundActive}</span>}
             {saveStatus === 'saved' && <span className="text-xs text-green-400 animate-in fade-in flex items-center gap-1"><Check size={12}/> {t.missionComplete}</span>}
             {user ? (
               <div className="relative">
                 <div onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-pink-500 flex items-center justify-center text-sm font-black text-white shadow-xl cursor-pointer hover:scale-105 transition-all">{getInitials()}</div>
                 {showProfileMenu && (
                   <div className="absolute top-full right-0 mt-2 w-48 bg-[#1e1f20] border border-white/10 rounded-xl shadow-2xl p-2 z-50">
                     <div className="px-3 py-2 border-b border-white/5 text-xs text-gray-400">Signed in as <p className="text-sm font-bold text-white truncate">{user.email}</p></div>
                     <button onClick={() => signOut(auth).then(() => setShowProfileMenu(false))} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded-lg transition-colors"><LogOut size={14}/> {t.signOut}</button>
                   </div>
                 )}
               </div>
             ) : <button onClick={() => setShowLoginModal(true)} className="px-4 py-1.5 bg-[#333537] hover:bg-[#444648] rounded-full text-xs font-bold transition-all shadow-lg">{t.signIn}</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollContainerRef} onScroll={handleScroll}>
          <div className="max-w-3xl mx-auto px-6 pt-8 pb-60 space-y-12">
            {currentData.messages.map((msg, index) => (
                <div key={msg.id} className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-[#333537] flex items-center justify-center shrink-0"><Sparkles size={16} className={theme.icon}/></div>}
                  <div className={`max-w-[85%] rounded-2xl p-4 relative ${msg.role === 'user' ? 'bg-[#28292a] text-[#e3e3e3] rounded-tr-none shadow-xl' : 'text-[#e3e3e3] leading-7'}`}>
                    <div className={msg.role === 'assistant' ? "prose prose-invert max-w-none" : ""}>
                      <ReactMarkdown components={{
                        p: ({children}) => <p className="m-0 leading-relaxed text-lg">{children}</p>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-400">{children}</blockquote>,
                        a: ({...p}) => <a {...p} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold no-underline hover:scale-105 transition-all text-white my-1 mx-0.5 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600">{p.children}</a>
                      }}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.isStopped && <div className="text-xs text-gray-400 mt-3 flex items-center gap-2 animate-pulse"><Octagon size={12}/> {t.stopped}</div>}

                    {msg.role === 'assistant' && !loading && (
                      <div className="flex items-center gap-2 mt-3">
                          <button onClick={() => copyText(msg.content, msg.id)} className="p-1 text-gray-400 hover:text-white transition-colors">
                              {copySuccessId === msg.id ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                          </button>
                          <div className="relative">
                              <button onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)} className="p-1 text-gray-400 hover:text-white">
                                  <Download size={14} />
                              </button>
                              {openMenuId === msg.id && (
                                  <div className="absolute top-full left-0 mt-1 bg-[#1e1f20] border border-white/10 rounded-lg shadow-2xl py-1 z-20 min-w-[100px]">
                                      <button onClick={() => handleExport(msg.content, 'pdf')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2"><FileType size={12}/> PDF</button>
                                      <button onClick={() => handleExport(msg.content, 'docx')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2"><FileText size={12}/> Word</button>
                                  </div>
                              )}
                          </div>
                      </div>
                    )}
                  </div>
                </div>
            ))}
            
            {currentData.messages.length === 0 && (
                <div key={mode} className="h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                    <div className={`p-8 rounded-full mb-8 bg-gradient-to-b ${theme.bg} to-transparent animate-pulse shadow-2xl`}><Sparkles size={72} className={theme.icon}/></div>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter mb-2">{currentGreeting}</h3>
                    <p className="text-gray-400 text-lg font-medium max-w-md italic">{currentTutorial}</p>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#131314] via-[#131314]/90 to-transparent">
          {/* LOCATION & HOURS INPUTS (MOVED TO BOTTOM) */}
          {mode === 'spy' && (
             <div className="max-w-3xl mx-auto mb-3 flex gap-2 animate-in slide-in-from-bottom-2">
                <div className="flex-1 flex items-center gap-2 bg-[#1e1f20] border border-white/10 rounded-full px-4 py-2 shadow-lg">
                   <MapPin size={14} className="text-purple-400" />
                   <input 
                      className="bg-transparent outline-none text-xs w-full text-white placeholder:text-gray-500"
                      placeholder="Location (e.g. New York)..."
                      value={toolState.spy.location}
                      onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, location: e.target.value } }))}
                   />
                </div>
                <div className="flex items-center gap-2 bg-[#1e1f20] border border-white/10 rounded-full px-4 py-2 shadow-lg">
                   <Briefcase size={14} className="text-blue-400" />
                   <select 
                      className="bg-transparent outline-none text-xs text-white cursor-pointer appearance-none"
                      value={toolState.spy.hours}
                      onChange={e => setToolState(p => ({ ...p, spy: { ...p.spy, hours: e.target.value } }))}
                   >
                      <option className="bg-[#1e1f20]" value="Full-Time">{t.fullTime}</option>
                      <option className="bg-[#1e1f20]" value="Part-Time">{t.partTime}</option>
                      <option className="bg-[#1e1f20]" value="Remote">{t.remote}</option>
                      <option className="bg-[#1e1f20]" value="Contract">Contract</option>
                   </select>
                </div>
             </div>
          )}

          <div className="max-w-3xl mx-auto bg-[#1e1f20] rounded-[2.5rem] border border-white/5 p-3 shadow-2xl relative transition-all duration-300">
             <div className="flex items-end gap-2 px-2 relative z-10">
               <button onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-[#333537] text-gray-400 rounded-full transition-all shrink-0 hover:scale-110 active:scale-95">
                  <UploadCloud size={24}/>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => {
                     if (e.target.files) {
                        setToolState(p => ({ ...p, [mode]: { ...p[mode], files: [...p[mode].files, ...Array.from(e.target.files!)] } }));
                     }
                  }}/>
               </button>
               <textarea 
                  className="flex-1 bg-transparent py-3 px-2 outline-none resize-none text-base text-white placeholder:text-[#8e918f] max-h-48 min-h-[52px]"
                  rows={1}
                  placeholder={`Ask JobWisely...`}
                  value={mode === 'spy' ? currentData.input : currentData.spec}
                  onChange={e => {
                     if (mode === 'spy') setToolState(p => ({ ...p, spy: { ...p.spy, input: e.target.value } }));
                     else setToolState(p => ({ ...p, [mode]: { ...p[mode], spec: e.target.value } }));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIAction(); } }}
               />
               <button onClick={loading ? handleStop : handleAIAction} className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ${loading ? 'border border-blue-500/30' : 'text-blue-400 hover:bg-[#333537]'}`}>
                  {loading ? <div className="w-3 h-3 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" /> : <Send size={28}/>}
               </button>
             </div>
             
             {currentData.files.length > 0 && (
                <div className="flex gap-2 px-4 pb-2 mt-2 overflow-x-auto">
                   {currentData.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#28292a] px-3 py-1.5 rounded-lg text-xs border border-white/5 shrink-0">
                         <span className="text-blue-400 font-bold">FILE</span>
                         <span className="max-w-[100px] truncate">{f.name}</span>
                         <button onClick={() => setToolState(p => ({ ...p, [mode]: { ...p[mode], files: p[mode].files.filter((_, idx) => idx !== i) } }))} className="hover:text-red-400"><X size={12}/></button>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}