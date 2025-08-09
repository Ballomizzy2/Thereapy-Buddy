"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

// Minimal typings for the Web Speech API used here
type SpeechResultItem = { transcript: string };
// The Web Speech API exposes a nested array-like structure: results[index][0].transcript
type SpeechResult = { 0: SpeechResultItem };
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const ctor: SpeechRecognitionConstructor | undefined =
      typeof window !== "undefined"
        ? (// Prefer standard if available, else use webkit prefixed
          (window as WindowWithSpeech).SpeechRecognition ||
          (window as WindowWithSpeech).webkitSpeechRecognition)
        : undefined;

    if (ctor) {
      setSupported(true);
      const recognition = new ctor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    }
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setListening(true);
    recognitionRef.current.start();
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
  }, []);

  return { recognitionRef, supported, listening, start, stop };
}

function speak(text: string) {
  if (typeof window === "undefined") return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {}
}

export default function VoiceBuddy() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const { recognitionRef, supported, listening, start, stop } = useSpeechRecognition();

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;
      const userMessage: ChatMessage = { id: nanoid(), role: "user", content };
      const assistantMessage: ChatMessage = { id: nanoid(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput("");
      setLoading(true);

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            acc += chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: acc } : m))
            );
          }
        }
        if (acc) speak(acc);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "assistant" && m.content === ""
              ? { ...m, content: "Sorry, I ran into a connection issue." }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages]
  );

  useEffect(() => {
    if (!recognitionRef.current) return;
    const recognition = recognitionRef.current;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        handleSend(transcript);
      }
    };
    recognition.onerror = () => setLoading(false);
    recognition.onend = () => {};
  }, [recognitionRef, handleSend]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSend();
    },
    [handleSend]
  );

  const disclaimer = useMemo(
    () =>
      "Therapy Buddy offers supportive conversation and coping ideas. It is not a substitute for professional care. If you are in crisis, contact local emergency services.",
    []
  );

  return (
    <div className="mx-auto max-w-3xl w-full flex flex-col gap-4">
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/70 dark:bg-black/30 backdrop-blur">
        <h1 className="text-2xl font-semibold mb-1">Therapy Buddy</h1>
        <p className="text-sm opacity-70">{disclaimer}</p>
      </div>

      <div className="flex-1 min-h-[50vh] rounded-xl border border-black/10 dark:border-white/10 p-4 overflow-y-auto bg-white/60 dark:bg-black/20">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm opacity-70">
            Start a conversation by talking or typing below.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "self-end max-w-[80%] rounded-2xl px-3 py-2 bg-blue-600 text-white"
                    : "self-start max-w-[80%] rounded-2xl px-3 py-2 bg-gray-200 dark:bg-gray-700"
                }
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-white dark:bg-black/30"
          placeholder="Type your thoughts..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2 bg-foreground text-background disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
        <button
          type="button"
          className={
            "rounded-full w-12 h-12 flex items-center justify-center border " +
            (listening ? "bg-red-600 text-white" : "bg-white dark:bg-black/30")
          }
          onClick={() => (listening ? stop() : start())}
          disabled={!supported || loading}
          title={supported ? (listening ? "Stop listening" : "Start speaking") : "Voice not supported"}
        >
          {listening ? "■" : "🎤"}
        </button>
      </form>

      {!supported && (
        <div className="text-xs opacity-70">
          Voice recognition is not supported in this browser. Try Chrome on desktop.
        </div>
      )}
    </div>
  );
}


