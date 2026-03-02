
import React, { useState, useEffect, useRef } from 'react';
import { getSettings } from '../services/settings';
import { AppSettings, ChatSession } from '../types';
import { getChatResponse } from '../services/gemini';
import { logChatSession } from '../services/db';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  isError?: boolean;
}

interface ChatWidgetProps {
  isLifted?: boolean;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ isLifted = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Guest Limit State
  const [guestCount, setGuestCount] = useState<number>(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('mr_active_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    const count = parseInt(localStorage.getItem('mr_guest_chat_count') || '0');
    setGuestCount(count);
  }, []);

  // Session tracking
  const sessionIdRef = useRef<string>('');
  const sessionStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionIdRef.current) {
      const existingId = sessionStorage.getItem('mr_chat_session_id');
      if (existingId) {
        sessionIdRef.current = existingId;
      } else {
        sessionIdRef.current = Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('mr_chat_session_id', sessionIdRef.current);
      }
      sessionStartTimeRef.current = Date.now();
    }

    getSettings().then(data => {
      setSettings(data);
      if (data.chatBot?.welcomeMessage && messages.length === 0) {
        setMessages([{ id: 0, text: data.chatBot.welcomeMessage, sender: 'bot' }]);
      }
    });
  }, []);

  useEffect(() => {
    const hasUserMessage = messages.some(m => m.sender === 'user');
    if (hasUserMessage) {
      saveSessionToDB();
    }
  }, [messages]);

  const saveSessionToDB = async () => {
    const chatMessages = messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
      text: m.text,
      timestamp: m.id
    }));

    let userDetails: any = {};
    try {
      const storedUser = localStorage.getItem('mr_active_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        userDetails = { userId: u.id, visitorName: u.name };
      }
    } catch (e) { }

    const session: ChatSession = {
      id: sessionIdRef.current,
      startTime: sessionStartTimeRef.current,
      lastMessageTime: Date.now(),
      messages: chatMessages,
      messageCount: chatMessages.length,
      userId: userDetails.userId,
      visitorName: userDetails.visitorName || `Visitor-${sessionIdRef.current.substring(0, 4)}`
    };

    await logChatSession(session);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Guest Limit Check
    if (!user && guestCount >= 5) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "You've reached the free chat limit. Please sign in to continue the conversation.",
        sender: 'bot',
        isError: true
      }]);
      return;
    }

    if (!user) {
      const newCount = guestCount + 1;
      setGuestCount(newCount);
      localStorage.setItem('mr_guest_chat_count', newCount.toString());
    }

    const userMsg: Message = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages
        .filter(m => !m.isError)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model' as 'user' | 'model',
          text: m.text
        }));

      const responseText = await getChatResponse(userMsg.text, history);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: responseText, sender: 'bot' }]);
    } catch (e) {
      console.error("Chat Error", e);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: "Sorry, I ran into an issue. Please try again.",
        sender: 'bot',
        isError: true
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!settings?.chatBot?.enabled) return null;

  const botName = settings.chatBot.botName || 'Dr. MedRussia';

  return (
    <>
      {/* Inline styles for animations */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatPulseRing {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes chatDotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes fabBreathe {
          0%, 100% { box-shadow: 0 4px 24px rgba(99, 102, 241, 0.4); }
          50%      { box-shadow: 0 6px 32px rgba(99, 102, 241, 0.6); }
        }
        .chat-slide-up { animation: chatSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .chat-msg-in { animation: chatFadeIn 0.3s ease-out forwards; }
        .chat-dot-1 { animation: chatDotBounce 1.2s infinite ease-in-out; }
        .chat-dot-2 { animation: chatDotBounce 1.2s infinite ease-in-out 0.15s; }
        .chat-dot-3 { animation: chatDotBounce 1.2s infinite ease-in-out 0.3s; }
        .fab-breathe { animation: fabBreathe 3s ease-in-out infinite; }
        .chat-scrollbar::-webkit-scrollbar { width: 4px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 99px; }
        .chat-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }
      `}</style>

      <div className={`fixed right-5 z-[60] flex flex-col items-end transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isLifted ? 'bottom-80' : 'bottom-28 md:bottom-20'}`}>

        {/* ─── Chat Window ─── */}
        {isOpen && (
          <div className="chat-slide-up mb-4 w-[340px] md:w-[400px] rounded-[24px] overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)]"
            style={{ backdropFilter: 'blur(20px)' }}>

            {/* ── Header ── */}
            <div className="relative px-5 py-4"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(30%, -40%)' }} />
              <div className="absolute bottom-0 left-6 w-16 h-16 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(-20%, 50%)' }} />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg"
                      style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                      🩺
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-[15px] tracking-tight">{botName}</h3>
                    <p className="text-[11px] text-indigo-100 font-medium mt-0.5">
                      Always here to help
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Messages Area ── */}
            <div className="h-[340px] overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-900/95 chat-scrollbar">
              {/* Date chip */}
              <div className="flex justify-center mb-2">
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Today
                </span>
              </div>

              {messages.map((msg, i) => (
                <div key={msg.id} className={`chat-msg-in flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}>

                  {/* Bot avatar */}
                  {msg.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0">
                      🩺
                    </div>
                  )}

                  <div className={`max-w-[78%] relative group ${msg.sender === 'user'
                      ? 'order-1'
                      : ''
                    }`}>
                    <div className={`px-4 py-2.5 text-[13px] leading-relaxed ${msg.sender === 'user'
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[18px] rounded-br-[6px] shadow-md shadow-indigo-200/40 dark:shadow-none'
                        : msg.isError
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/40 rounded-[18px] rounded-bl-[6px]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[18px] rounded-bl-[6px] shadow-sm border border-slate-100 dark:border-slate-700/60'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="chat-msg-in flex justify-start">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0">
                    🩺
                  </div>
                  <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-[18px] rounded-bl-[6px] shadow-sm border border-slate-100 dark:border-slate-700/60 flex gap-1.5 items-center">
                    <span className="chat-dot-1 w-2 h-2 bg-indigo-400 dark:bg-indigo-300 rounded-full opacity-70" />
                    <span className="chat-dot-2 w-2 h-2 bg-indigo-400 dark:bg-indigo-300 rounded-full opacity-70" />
                    <span className="chat-dot-3 w-2 h-2 bg-indigo-400 dark:bg-indigo-300 rounded-full opacity-70" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Guest Limit Banner ── */}
            {!user && guestCount >= 5 && (
              <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800/40 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-800/30 flex items-center justify-center text-sm flex-shrink-0">🔒</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Free limit reached</p>
                  <a href="/login" className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    Sign in to continue →
                  </a>
                </div>
              </div>
            )}

            {/* ── Input Area ── */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl pr-1.5 border border-slate-100 dark:border-slate-700/60 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all duration-200">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask about MBBS in Russia..."
                  disabled={!user && guestCount >= 5}
                  className="flex-1 bg-transparent border-none px-4 py-3 text-[13px] font-medium outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-40"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: input.trim() && !isTyping
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'transparent',
                    color: input.trim() && !isTyping ? 'white' : '#94a3b8'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {/* Powered by line */}
              <p className="text-center text-[9px] text-slate-300 dark:text-slate-600 mt-2 font-medium tracking-wide">
                Powered by AI • MedRussia
              </p>
            </div>
          </div>
        )}

        {/* ─── Floating Action Button ─── */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group relative w-[60px] h-[60px] rounded-[20px] flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isOpen
              ? 'bg-slate-800 dark:bg-slate-700 rotate-0 scale-90 shadow-lg'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-105 active:scale-95 fab-breathe'
            }`}
        >
          {/* Pulse ring when closed */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-[20px] border-2 border-indigo-400/50"
              style={{ animation: 'chatPulseRing 2.5s ease-out infinite' }} />
          )}

          {isOpen ? (
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-white transition-transform duration-300">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-white drop-shadow-sm">
              <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}

          {/* Notification badge */}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-[2.5px] border-white dark:border-slate-900 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </span>
          )}
        </button>
      </div>
    </>
  );
};
