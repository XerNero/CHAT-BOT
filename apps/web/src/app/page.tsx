"use client";

import { useState, useRef, useEffect } from "react";

// Types
// Types
interface Source {
  ref: string;
  id: string;
  source_file: string;
  chunk_index: number;
  fused_score: number;
  hop?: string; // For multi-hop mode
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer?: string; // Changed: now a simple markdown string
  sources?: Source[];
  timestamp: Date;
}

interface Document {
  id: string;
  source_file: string;
  chunks: number;
}

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [useMultihop, setUseMultihop] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetch(`${API_URL}/docs`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.docs) {
          setDocs(data.docs);
        }
      })
      .catch(console.error);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const toggleDocSelection = (docFile: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docFile)) {
        next.delete(docFile);
      } else {
        next.add(docFile);
      }
      return next;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const endpoint = useMultihop ? "/chat-multihop" : "/chat";
      // Construct history properly for single-string answers
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.role === "user" ? m.content : (m.answer || m.content || ""),
      }));

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          history: historyPayload,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        answer: data.answer, // now string
        sources: data.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Maaf, terjadi kesalahan. Pastikan server backend sudah berjalan.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Render citation with highlighting
  // Render citation with highlighting & Markdown bold
  const renderTextWithCitations = (text: string) => {
    if (!text) return null;

    // Split by citation pattern [#1]
    const parts = text.split(/(\[#\d+\])/g);

    return (
      <>
        {parts.map((part, i) => {
          if (part.match(/^\[#\d+\]$/)) {
            return (
              <span key={i} className="citation-badge">
                {part}
              </span>
            );
          }
          // Markdown bold support **text**
          const boldParts = part.split(/(\*\*.*?\*\*)/g);
          return boldParts.map((bp, j) => {
            if (bp.startsWith('**') && bp.endsWith('**')) {
              return <strong key={`${i}-${j}`} className="font-bold text-[var(--primary)]">{bp.slice(2, -2)}</strong>;
            }
            return <span key={`${i}-${j}`}>{bp}</span>;
          });
        })}
      </>
    );
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-300 overflow-hidden glass border-r border-[var(--border)] flex flex-col`}
      >
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Sumber Dokumen ({docs.length})
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">Semua dokumen digunakan sebagai sumber jawaban</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {docs.length === 0 ? (
            <p className="text-xs text-[var(--muted)] text-center py-4">
              Belum ada dokumen
            </p>
          ) : (
            <div className="space-y-1">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[var(--secondary)]/30"
                >
                  <svg className="w-4 h-4 mt-0.5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" title={doc.source_file}>
                      {doc.source_file}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {doc.chunks} chunks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="glass border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Sidebar Toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                title={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold">Chatbot RAG</h1>
                <p className="text-sm text-[var(--muted)]">Asisten Dokumen Kampus</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Multi-hop Toggle */}
              <button
                onClick={() => setUseMultihop(!useMultihop)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${useMultihop
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                  : "bg-[var(--secondary)] text-[var(--muted)] border border-transparent"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {useMultihop ? "Multi-hop" : "Single-hop"}
              </button>
              <span className="flex items-center gap-1.5 text-sm text-[var(--success)]">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
                Online
              </span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-20 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Selamat Datang!</h2>
                <p className="text-[var(--muted)] mb-8 max-w-md mx-auto">
                  Tanyakan apa saja tentang peraturan dan layanan kampus. Jawaban hanya berdasarkan dokumen resmi.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    "Apa saja layanan akademik yang tersedia?",
                    "Bagaimana prosedur pengajuan cuti?",
                    "Apa sanksi pelanggaran akademik?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="px-4 py-2 rounded-xl bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors text-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`animate-fade-in ${message.role === "user" ? "flex justify-end" : ""
                  }`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[80%] px-5 py-3 rounded-2xl rounded-br-md bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white">
                    {message.content}
                  </div>
                ) : (
                  <div className="glass rounded-2xl rounded-bl-md overflow-hidden">
                    {message.content ? (
                      <div className="px-5 py-4 text-[var(--error)]">
                        {message.content}
                      </div>
                    ) : message.answer ? (
                      <div className="divide-y divide-[var(--border)]">
                        <div className="px-6 py-5">
                          <div className="answer-content text-base leading-7 whitespace-pre-wrap">
                            {renderTextWithCitations(message.answer)}
                          </div>
                        </div>

                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="px-5 py-3 bg-[var(--background)]/50">
                            <button
                              onClick={() => toggleSources(message.id)}
                              className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${expandedSources.has(message.id) ? "rotate-90" : ""
                                  }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span>Lihat {message.sources.length} Sumber</span>
                            </button>

                            {expandedSources.has(message.id) && (
                              <div className="mt-3 space-y-2 animate-fade-in">
                                {message.sources.map((source, idx) => (
                                  <div
                                    key={`${source.id}-${source.chunk_index}-${idx}`}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--secondary)]"
                                  >
                                    <span className="citation">{source.ref}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm truncate">{source.source_file}</p>
                                        {source.hop && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--primary)]/20 text-[var(--primary)]">
                                            {source.hop}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-[var(--muted)]">
                                        Chunk #{source.chunk_index} • Score: {source.fused_score.toFixed(4)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="animate-fade-in">
                <div className="glass rounded-2xl rounded-bl-md px-5 py-4 inline-flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-sm text-[var(--muted)]">Mencari di dokumen...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input area */}
        <footer className="glass border-t border-[var(--border)] px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-[var(--secondary)] rounded-2xl px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tanyakan sesuatu..."
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-[var(--foreground)] placeholder-[var(--muted)] max-h-[150px]"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[var(--primary)]/25 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-[var(--muted)] mt-2">
              Jawaban hanya berdasarkan dokumen resmi kampus
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
