"use client";

import { useEffect, useState, useRef } from 'react';
import dayjs from 'dayjs';

export default function Chatbot({ events = [], refreshSignal, isOpen, onToggle }) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const messagesEndRef = useRef(null);

  const open = isOpen;
  const setOpen = (val) => {
    if (onToggle) onToggle(val);
  };

  // Get current user
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        setCurrentUser(data.user || null);
      } catch (e) {
        setCurrentUser(null);
      }
    })();
  }, []);

  // Handle animation mount/unmount
  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimating(true);
      const timeout = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timeout);
    } else {
      setAnimating(true);
      const timeout1 = setTimeout(() => setVisible(false), 300);
      const timeout2 = setTimeout(() => setAnimating(false), 300);
      return () => { clearTimeout(timeout1); clearTimeout(timeout2); };
    }
  }, [open]);

  // Welcome message when opened
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      setMessages([
        {
          role: 'bot',
          text: 'Halo! 👋 Saya SILVI, asisten virtual untuk jadwal kegiatan. Tanyakan apa saja tentang jadwal, misalnya:\n\n• "Ada kegiatan apa besok?"\n• "Kapan rapat berikutnya?"\n• "Jadwal minggu ini"\n\nSilakan bertanya!'
        },
      ]);
    }
  }, [open, messages.length]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAsk = async (e) => {
    e && e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Build conversation history (exclude welcome message and ensure starts with user)
      const history = messages
        .filter(msg => msg.role === 'user' || (msg.role === 'bot' && !msg.text.includes('Halo! 👋')))
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'bot',
          content: msg.text
        }));

      // Call AI API
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          history: history,
          userId: currentUser?.id || null
        })
      });

      const data = await res.json();

      if (data.success && data.response) {
        // Add bot response
        setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
      } else {
        // Error response
        setMessages(prev => [...prev, {
          role: 'bot',
          text: data.response || data.error || 'Maaf, terjadi kesalahan. Silakan coba lagi.'
        }]);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'Maaf, saya sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat. 🙏'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'bot',
        text: 'Halo! 👋 Saya SILVI, asisten virtual untuk jadwal kegiatan. Tanyakan apa saja tentang jadwal!'
      }
    ]);
  };

  return (
    <>
      {/* Floating round button (kanan bawah) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(!open)}
          title="Chatbot AI"
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center transition-transform duration-200 hover:scale-110"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
        </button>
      </div>

      {visible && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 pointer-events-none"
            style={{ background: 'transparent' }}
          />

          {/* Chatbot Container */}
          <div
            className="fixed inset-0 z-[100] flex items-end justify-end"
            onClickCapture={e => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <div
              className={
                `bg-gradient-to-br from-blue-50 to-blue-100 w-full max-w-md h-3/4 m-6 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border border-blue-200 ` +
                (open && animating ? 'opacity-0 scale-90 translate-y-8 pointer-events-none' : '') +
                (open && !animating ? 'opacity-100 scale-100 translate-y-0' : '') +
                (!open && animating ? 'opacity-0 scale-90 translate-y-8 pointer-events-none' : '')
              }
              style={{ pointerEvents: 'auto' }}
            >
              {/* Header */}
              <div className="px-5 py-4 bg-blue-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🤖</div>
                  <div>
                    <div className="font-bold text-lg">SILVI AI</div>
                    <div className="text-xs opacity-90">Asisten Virtual Jadwal</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearChat}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Hapus Percakapan"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Tutup"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="p-4 flex-1 overflow-auto bg-white">
                {messages.map((m, i) => (
                  <div key={i} className={`mb-4 ${m.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[80%] ${m.role === 'user'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-gray-800 border border-blue-100 shadow-sm'
                      } px-4 py-3 rounded-2xl`}>
                      <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                      <div className={`text-xs mt-1 ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                        {dayjs().format('HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="mb-4">
                    <div className="inline-block bg-white text-gray-800 border border-blue-100 px-4 py-3 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleAsk} className="p-4 border-t border-blue-200 bg-white flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ketik pertanyaan Anda..."
                  className="flex-1 border border-blue-200 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? '...' : 'Kirim'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
