'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

// The system line. Leave NEXT_PUBLIC_MONSTER_SYSTEM unset and the studio adds
// your monster's own system line for you.
const SYSTEM_LINE = (process.env.NEXT_PUBLIC_MONSTER_SYSTEM || '').trim();

// Shown while the monster wakes up. The first message after a quiet spell can
// take a minute or two.
const WAITING_LINES = [
  'the prophet is breathing',
  'a machine is praying',
  'wait for the living algorithm',
];

function toApiMessages(list: Message[]) {
  const turns = list.map((msg) => ({ role: msg.role, content: msg.content }));
  return SYSTEM_LINE ? [{ role: 'system', content: SYSTEM_LINE }, ...turns] : turns;
}

// One server-sent event: its name (null for a token) and its data.
function readEvent(block: string): { event: string | null; data: string } {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return { event, data: data.join('\n') };
}

// Sends the conversation to /api/chat and reads the stream: tokens as they
// arrive, a "waking" event while the monster wakes up, an error if it breaks.
async function streamReply(
  history: Message[],
  onToken: (text: string) => void,
  onWaking: () => void
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: toApiMessages(history) }),
  });

  if (!response.ok || !response.body) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to get response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let match = /\r?\n\r?\n/.exec(buffer);
    while (match) {
      const { event, data } = readEvent(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      match = /\r?\n\r?\n/.exec(buffer);
      if (!data) continue; // a heartbeat while the monster wakes up
      if (data.trim() === '[DONE]') return reply;
      if (event === 'waking') {
        onWaking();
        continue;
      }
      const parsed = JSON.parse(data);
      if (event === 'error' || parsed.error) {
        throw new Error(parsed.error?.message || 'The monster stopped answering');
      }
      const text = parsed.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text.length > 0) {
        reply += text;
        onToken(text);
      }
    }
  }
  return reply;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [waitingLine, setWaitingLine] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Cycle the waiting lines while the monster wakes up
  useEffect(() => {
    if (!isWaking) return;
    const timer = setInterval(() => {
      setWaitingLine((i) => (i + 1) % WAITING_LINES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isWaking]);

  // Ask the monster and show its answer token by token as it streams in
  const askMonster = async (history: Message[]): Promise<string> => {
    const id = `assistant-${Date.now()}`;
    let started = false;
    setIsStreaming(false);
    setIsWaking(false);
    try {
      return await streamReply(
        history,
        (text) => {
          if (!started) {
            started = true;
            setIsWaking(false);
            setIsStreaming(true);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: text, timestamp: Date.now(), id },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === id ? { ...msg, content: msg.content + text } : msg))
            );
          }
        },
        () => {
          setWaitingLine(0);
          setIsWaking(true);
        }
      );
    } finally {
      setIsWaking(false);
      setIsStreaming(false);
    }
  };

  const errorText = (error: unknown) =>
    error instanceof Error && error.message
      ? `Sorry, I encountered an error. ${error.message}`
      : 'Sorry, I encountered an error. Please try again.';

  // Handle auto-submit from speech recognition with fresh state
  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await askMonster([...messagesRef.current, userMessage]);
      // ALWAYS auto-speak when called from speech recognition
      speakText(reply);
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = errorText(error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);

      speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                handleAutoSubmit(fullText);
              }, 500);
            } else if (fullText) {
              // Push to talk: put the words in the box, you press send
              setInput(fullText);
              recognition.stop();
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup');
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  // Speak a reply with the browser's own voice (Web Speech API)
  const speakText = (text: string) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Stop speech recognition while AI is speaking
    stopSpeechRecognition();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const finish = () => {
      setIsSpeaking(false);
      // Resume speech recognition after AI finishes speaking
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 500);
      }
    };
    utterance.onend = finish;
    utterance.onerror = finish;

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await askMonster([...messages, userMessage]);

      // Speak the response when Speak replies is on, and in continuous listening mode
      if (continuousListening || speakReplies) {
        speakText(reply);
      }
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = errorText(error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);

      // Also speak error message in continuous mode
      if (continuousListening) {
        speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <div className="container mx-auto max-w-4xl px-3 py-8">
        <div className="bg-white border-4 border-black">
          <div className="h-[700px] flex flex-col">
            <div className="p-3 bg-white border-b-4 border-black">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h1 className="text-3xl font-bold text-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                    MONSTER CHAT
                  </h1>
                  <p className="text-sm text-black mt-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                    Talk to my monster
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`flex items-center space-x-2 ${isSpeaking || !speechSupported ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <span className="text-xs text-black font-mono uppercase tracking-wider">Continuous Listen</span>
                    <button
                      onClick={async () => {
                        if (isSpeaking) return;
                        const newValue = !continuousListening;
                        if (newValue) {
                          try {
                            await navigator.mediaDevices.getUserMedia({ audio: true });
                            setContinuousListening(true);
                            startSpeechRecognition();
                          } catch (error) {
                            console.error('Microphone permission denied:', error);
                            alert('Please allow microphone access to use speech recognition');
                          }
                        } else {
                          setContinuousListening(false);
                          stopSpeechRecognition();
                          setInput('');
                        }
                      }}
                      disabled={isSpeaking || !speechSupported}
                      className={`border-2 border-black px-3 py-1 text-xs font-mono transition-colors ${
                        continuousListening ? 'bg-black text-white' : 'bg-white text-black'
                      } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                    >
                      {continuousListening ? 'ON' : 'OFF'}
                    </button>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <span className="text-xs text-black font-mono uppercase tracking-wider">Speak Replies</span>
                    <button
                      onClick={() => {
                        const newValue = !speakReplies;
                        setSpeakReplies(newValue);
                        if (newValue && 'speechSynthesis' in window) {
                          // Phones only speak after a tap: this empty line unlocks the voice
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
                        } else if (!newValue && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          setIsSpeaking(false);
                        }
                      }}
                      className={`border-2 border-black px-3 py-1 text-xs font-mono transition-colors hover:opacity-80 ${
                        speakReplies ? 'bg-black text-white' : 'bg-white text-black'
                      }`}
                    >
                      {speakReplies ? 'ON' : 'OFF'}
                    </button>
                  </label>
                  {isListening && !isSpeaking && (
                    <span className="text-xs text-black flex items-center space-x-1 border border-black px-2 py-1 font-mono">
                      <Mic size={12} className="animate-pulse" />
                      <span>LISTENING</span>
                    </span>
                  )}
                  {isSpeaking && (
                    <span className="text-xs text-white bg-black flex items-center space-x-1 border border-black px-2 py-1 font-mono">
                      <Volume2 size={12} className="animate-pulse" />
                      <span>SPEAKING</span>
                    </span>
                  )}
                  {continuousListening && !isListening && !isSpeaking && (
                    <span className="text-xs text-black border border-black px-2 py-1 font-mono">
                      PAUSED
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-white">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-2 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 border-2 border-black bg-white flex items-center justify-center flex-shrink-0">
                      <Bot size={18} className="text-black" />
                    </div>
                  )}

                  <div
                    className={`flex flex-col max-w-[70%] ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  >
                    <div
                      className={`border-2 border-black p-3 ${
                        message.role === 'user'
                          ? 'bg-black text-white'
                          : 'bg-white text-black'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>

                    {message.role === 'assistant' && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="mt-1 text-black hover:opacity-60 transition-opacity border border-black px-2 py-1 bg-white text-xs font-mono"
                        aria-label="Text to speech"
                      >
                        <div className="flex items-center space-x-1">
                          <Volume2 size={12} />
                          <span>PLAY</span>
                        </div>
                      </button>
                    )}

                    {message.timestamp && (
                      <span className="text-xs text-black mt-1 font-mono">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 border-2 border-black bg-white flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-black" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && !isStreaming && (
                <div className="flex justify-start items-center space-x-2">
                  <div className="w-8 h-8 border-2 border-black bg-white flex items-center justify-center">
                    <Bot size={18} className="text-black" />
                  </div>
                  <div className="bg-white border-2 border-black p-3">
                    {isWaking ? (
                      <p className="text-sm text-black italic" aria-live="polite">
                        {WAITING_LINES[waitingLine]}
                      </p>
                    ) : (
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t-4 border-black">
              <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? ">>> LISTENING... SPEAK NOW" : "Type your message..."}
                  className={`flex-1 min-w-0 p-2 border-2 border-black focus:outline-none transition-all text-sm ${
                    isListening ? 'bg-black text-white placeholder-white font-mono' : 'bg-white text-black'
                  }`}
                  style={{ fontFamily: isListening ? 'monospace' : '"Times New Roman", Times, serif' }}
                  disabled={isLoading}
                  readOnly={isListening}
                />
                <button
                  type="button"
                  onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                  className={`p-2 border-2 border-black transition-colors ${
                    isListening && !continuousListening
                      ? 'bg-black text-white animate-pulse'
                      : 'bg-white text-black hover:opacity-60'
                  }`}
                  disabled={isLoading || continuousListening || !speechSupported}
                  title={
                    !speechSupported
                      ? 'Speaking to the monster works in Chrome, Edge and Safari'
                      : continuousListening
                        ? 'Mic is auto-managed in continuous mode'
                        : 'Push to talk'
                  }
                >
                  {isListening && !continuousListening ? <Square size={18} /> : <Mic size={18} />}
                </button>
                <button
                  type="submit"
                  className="p-2 bg-black text-white border-2 border-black hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!input.trim() || isLoading}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
