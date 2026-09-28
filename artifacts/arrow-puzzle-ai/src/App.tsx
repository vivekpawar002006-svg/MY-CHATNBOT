import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendChatMessage } from '@workspace/api-client-react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type Role = 'user' | 'assistant';

type LocalMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

type ChatThread = {
  id: string;
  title: string;
  messages: LocalMessage[];
  updatedAt: string;
};

type FailedAttempt = {
  messageId: string;
  content: string;
};

const STORAGE_KEY = 'arrow-puzzle-ai-chats';
const FRIENDLY_ERROR =
  'Sorry, I’m having trouble connecting right now. Please try again in a moment.';

const makeThread = (): ChatThread => ({
  id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: 'New puzzle',
  messages: [],
  updatedAt: new Date().toISOString(),
});

const loadThreads = (): ChatThread[] => {
  if (typeof window === 'undefined') return [makeThread()];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [makeThread()];
    const parsed = JSON.parse(stored) as ChatThread[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [makeThread()];
  } catch {
    return [makeThread()];
  }
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

const formatThreadDate = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatTime(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const suggestions = [
  { label: 'Find my next move', prompt: 'I am stuck. How should I think about finding my next move?' },
  { label: 'Explain the strategy', prompt: 'Explain the best general strategy for Arrow Puzzle in a concise way.' },
  { label: 'Avoid a dead end', prompt: 'What mistakes usually create a dead end, and how can I spot one early?' },
  { label: 'Help me improve', prompt: 'Give me one focused practice drill to improve at Arrow Puzzle.' },
];

function ArrowMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${small ? 'rounded-[10px] h-8 w-8' : 'rounded-[16px] h-14 w-14'} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_7px_16px_hsl(var(--primary)/.2)]`}
      aria-hidden="true"
    >
      <span className={`absolute ${small ? 'h-1.5 w-4' : 'h-2 w-7'} -translate-x-0.5 rounded-full bg-current`} />
      <ArrowUpRight className={small ? 'h-4 w-4' : 'h-7 w-7'} strokeWidth={2.5} />
    </div>
  );
}

function ChatRail({
  threads,
  activeId,
  onSelect,
  onNew,
  onClear,
  onClose,
  isMobile = false,
}: {
  threads: ChatThread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClear: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}) {
  return (
    <aside className={`${isMobile ? 'fixed inset-y-0 left-0 z-50 flex w-[min(86vw,330px)]' : 'hidden w-[292px] shrink-0 md:flex'} flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]`}>
      <div className="flex h-[84px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-5">
        <div className="flex items-center gap-3">
          <ArrowMark small />
          <div>
            <div className="font-display text-[15px] font-bold tracking-[-0.02em]">Arrow Puzzle <span className="text-[hsl(var(--sidebar-primary))]">AI</span></div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--sidebar-foreground)/.52)]">Focused play, better moves</div>
          </div>
        </div>
        {isMobile && (
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.6)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]" aria-label="Close chat history" data-testid="button-close-history">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-4 pt-5">
        <button type="button" onClick={onNew} className="group flex h-11 w-full items-center justify-between rounded-xl bg-[hsl(var(--sidebar-primary))] px-3.5 text-left text-[hsl(var(--sidebar-primary-foreground))] transition-transform hover:-translate-y-0.5 active:translate-y-0" data-testid="button-new-chat">
          <span className="flex items-center gap-2.5 text-[13px] font-bold"><MessageSquarePlus className="h-4 w-4" /> New chat</span>
          <span className="font-mono text-[10px] opacity-55">N</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--sidebar-foreground)/.45)]">Your puzzles</span>
        <span className="font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.35)]">{threads.length.toString().padStart(2, '0')}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {threads.map((thread) => {
          const isActive = activeId === thread.id;
          const lastMessage = thread.messages[thread.messages.length - 1];
          return (
            <button
              type="button"
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              className={`group w-full rounded-xl px-3 py-3 text-left transition-colors ${isActive ? 'bg-[hsl(var(--sidebar-accent))]' : 'hover:bg-[hsl(var(--sidebar-accent)/.65)]'}`}
              data-testid={`button-thread-${thread.id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`truncate text-[12px] font-semibold ${isActive ? 'text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.75)]'}`}>{thread.title}</span>
                <span className="shrink-0 font-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.35)]">{formatThreadDate(thread.updatedAt)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[hsl(var(--sidebar-foreground)/.4)]">
                {lastMessage ? <span className="truncate">{lastMessage.content}</span> : <span>Empty board</span>}
                {isActive && <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-[hsl(var(--sidebar-primary))]" />}
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
        <button type="button" onClick={onClear} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-[hsl(var(--sidebar-foreground)/.55)] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]" data-testid="button-clear-chat">
          <Trash2 className="h-3.5 w-3.5" /> Clear current chat
        </button>
        <div className="mt-4 flex items-center gap-2 px-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[hsl(var(--sidebar-foreground)/.3)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Local history on</div>
      </div>
    </aside>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (prompt: string) => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-8 text-center">
      <div className="arrow-grid relative mb-7 flex h-[122px] w-[122px] items-center justify-center rounded-[30px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)]">
        <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
        <div className="absolute bottom-5 right-5 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
        <ArrowMark />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--accent))]">The next move is closer than it looks</div>
      <h1 className="mt-4 max-w-[520px] font-display text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.03] tracking-[-0.055em] text-[hsl(var(--foreground))]">A clear head for a tricky board.</h1>
      <p className="mt-4 max-w-[480px] text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">Tell Arrow Puzzle AI where you are stuck. Get a precise nudge, not a lecture.</p>
      <div className="mt-9 grid w-full max-w-[620px] grid-cols-1 gap-2.5 sm:grid-cols-2">
        {suggestions.map((item, index) => (
          <button type="button" key={item.label} onClick={() => onSuggestion(item.prompt)} className="group flex min-h-[62px] items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.56)] px-4 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.55)] hover:bg-[hsl(var(--card))] hover:shadow-[0_8px_22px_hsl(var(--foreground)/.06)]" data-testid={`button-suggestion-${index}`}>
            <span><span className="block text-[12px] font-bold text-[hsl(var(--foreground))]">{item.label}</span><span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">Ask for a focused hint</span></span>
            <ArrowUpRight className="h-4 w-4 text-[hsl(var(--muted-foreground)/.55)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--primary))]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function renderInlineMarkdown(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      blocks.push(
        <p key={`heading-${index}`} className="font-display font-bold">
          {renderInlineMarkdown(line.replace(/^#{1,3}\s+/, ''))}
        </p>,
      );
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^#{1,3}\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(paragraph.join('\n'))}
      </p>,
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}

function MessageBubble({
  message,
  onCopy,
  copied,
}: {
  message: LocalMessage;
  onCopy: (message: LocalMessage) => void;
  copied: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <article className={`rise-in flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.role}-${message.id}`}>
      {!isUser && <ArrowMark small />}
      <div className={`max-w-[min(720px,88%)] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3.5 text-[13px] leading-[1.7] ${isUser ? 'rounded-br-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-[0_3px_12px_hsl(var(--foreground)/.035)]'}`}>
          <div className="message-copy" data-testid={`text-message-${message.id}`}>
            <MarkdownContent content={message.content} />
          </div>
        </div>
        <div className={`mt-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground)/.7)] ${isUser ? 'flex-row-reverse' : ''}`}>
          <span data-testid={`timestamp-message-${message.id}`}>{formatTime(message.createdAt)}</span>
          {!isUser && (
            <button type="button" onClick={() => onCopy(message)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" data-testid={`button-copy-${message.id}`}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function AssistantLoading() {
  return (
    <div className="rise-in flex items-start gap-3.5" data-testid="status-loading">
      <ArrowMark small />
      <div className="rounded-2xl rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-4 shadow-[0_3px_12px_hsl(var(--foreground)/.035)]">
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--primary)/.7)] [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--primary)/.45)] [animation-delay:240ms]" /></div>
      </div>
    </div>
  );
}

function Home() {
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<FailedAttempt | null>(null);
  const [stoppedRequest, setStoppedRequest] = useState(false);
  const requestId = useRef(0);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const sendChat = useSendChatMessage();
  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeId) ?? threads[0], [threads, activeId]);
  const messages = activeThread?.messages ?? [];
  const isSending = sendChat.isPending && !stoppedRequest;

  useEffect(() => {
    if (!activeId && threads[0]) setActiveId(threads[0].id);
  }, [activeId, threads]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLTextAreaElement>('[data-testid="input-chat"]')?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const updateThread = (threadId: string, update: (thread: ChatThread) => ChatThread) => {
    setThreads((current) => current.map((thread) => (thread.id === threadId ? update(thread) : thread)));
  };

  const handleNewChat = () => {
    const next = makeThread();
    setThreads((current) => [next, ...current]);
    setActiveId(next.id);
    setInput('');
    setErrorMessage(null);
    setFailedAttempt(null);
    setStoppedRequest(false);
    setMobileHistoryOpen(false);
  };

  const handleClear = () => {
    if (!activeThread) return;
    if (activeThread.messages.length > 0 && !window.confirm('Clear this puzzle chat?')) return;
    const next = makeThread();
    updateThread(activeThread.id, () => next);
    setActiveId(next.id);
    setThreads((current) => [next, ...current.filter((thread) => thread.id !== activeThread.id)]);
    setInput('');
    setErrorMessage(null);
    setFailedAttempt(null);
  };

  const sendText = (text: string, baseMessages?: LocalMessage[]) => {
    const trimmed = text.trim();
    if (!trimmed || !activeThread) return;
    const userMessage: LocalMessage = { id: `message-${Date.now()}`, role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    const conversation = [...(baseMessages ?? activeThread.messages), userMessage];
    const threadId = activeThread.id;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setStoppedRequest(false);
    setErrorMessage(null);
    setFailedAttempt(null);
    setInput('');
    updateThread(threadId, (thread) => ({
      ...thread,
      title: thread.messages.length === 0 ? trimmed.slice(0, 30) : thread.title,
      messages: conversation,
      updatedAt: userMessage.createdAt,
    }));
    sendChat.mutate(
      { data: { messages: conversation.slice(-30).map(({ role, content }) => ({ role, content })) } },
      {
        onSuccess: (response) => {
          if (requestId.current !== currentRequest || activeIdRef.current !== threadId) return;
          const assistantMessage: LocalMessage = { id: `message-${Date.now()}-assistant`, role: 'assistant', content: response.message.content, createdAt: new Date().toISOString() };
          updateThread(threadId, (thread) => ({ ...thread, messages: [...thread.messages, assistantMessage], updatedAt: assistantMessage.createdAt }));
        },
        onError: (error) => {
          if (requestId.current !== currentRequest) return;
          void error;
          setErrorMessage(FRIENDLY_ERROR);
          setFailedAttempt({ messageId: userMessage.id, content: trimmed });
        },
      },
    );
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    sendText(input);
  };

  const handleRetry = () => {
    if (!failedAttempt || !activeThread) return;
    const baseMessages = activeThread.messages.filter((message) => message.id !== failedAttempt.messageId);
    sendText(failedAttempt.content, baseMessages);
  };

  const handleCopy = async (message: LocalMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1600);
    } catch {
      setCopiedId(null);
    }
  };

  const handleStop = () => {
    requestId.current += 1;
    setStoppedRequest(true);
    setErrorMessage(null);
  };

  return (
    <div className="app-grain flex min-h-[100dvh] w-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <ChatRail threads={threads} activeId={activeThread?.id ?? ''} onSelect={(id) => { setActiveId(id); setMobileHistoryOpen(false); setErrorMessage(null); }} onNew={handleNewChat} onClear={handleClear} />
      {mobileHistoryOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[hsl(var(--foreground)/.35)] backdrop-blur-[2px] md:hidden" onClick={() => setMobileHistoryOpen(false)} aria-hidden="true" />
          <ChatRail isMobile threads={threads} activeId={activeThread?.id ?? ''} onSelect={(id) => { setActiveId(id); setMobileHistoryOpen(false); }} onNew={handleNewChat} onClear={handleClear} onClose={() => setMobileHistoryOpen(false)} />
        </>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[84px] shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileHistoryOpen(true)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] md:hidden" aria-label="Open chat history" data-testid="button-open-history"><Menu className="h-5 w-5" /></button>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Companion online</div>
              <div className="mt-1 font-display text-[15px] font-bold tracking-[-0.02em]" data-testid="text-active-chat-title">{activeThread?.title ?? 'New puzzle'}</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.13em] text-[hsl(var(--muted-foreground)/.7)] sm:flex"><Clock3 className="h-3.5 w-3.5" /> Context saved locally <span className="ml-1 text-[hsl(var(--muted-foreground)/.38)]">⌘ K</span></div>
          <button type="button" onClick={handleNewChat} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] px-3 py-2 text-[11px] font-bold text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--card))] md:hidden" data-testid="button-mobile-new-chat"><MessageSquarePlus className="h-3.5 w-3.5" /> New</button>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-[1030px] flex-1 flex-col">
          {messages.length === 0 ? <EmptyState onSuggestion={sendText} /> : (
            <section className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12" data-testid="region-message-list">
              <div className="mx-auto flex max-w-[760px] flex-col gap-6">
                <div className="mb-1 flex items-center justify-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground)/.55)]"><span className="h-px w-10 bg-[hsl(var(--border))]" /> Puzzle context <span className="h-px w-10 bg-[hsl(var(--border))]" /></div>
                {messages.map((message) => <MessageBubble key={message.id} message={message} onCopy={handleCopy} copied={copiedId === message.id} />)}
                {isSending && <AssistantLoading />}
                {errorMessage && (
                  <div className="rise-in flex items-center justify-between gap-4 rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.06)] px-4 py-3 text-[12px] text-[hsl(var(--destructive))]" data-testid="status-error">
                    <span className="flex min-w-0 items-center gap-2"><MoreHorizontal className="h-4 w-4 shrink-0" /> <span className="truncate">{errorMessage}</span></span>
                    <button type="button" onClick={handleRetry} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[hsl(var(--card))] px-2.5 py-1.5 text-[11px] font-bold text-[hsl(var(--foreground))] shadow-sm hover:bg-[hsl(var(--background))]" data-testid="button-retry"><RotateCcw className="h-3 w-3" /> Retry</button>
                  </div>
                )}
                <div ref={messageEndRef} aria-hidden="true" />
              </div>
            </section>
          )}

          <div className="px-4 pb-5 pt-3 sm:px-8 sm:pb-8 lg:px-12">
            <div className="mx-auto max-w-[760px]">
              {messages.length > 0 && !isSending && !errorMessage && (
                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent))]" />
                  {suggestions.slice(0, 3).map((item, index) => <button type="button" key={item.label} onClick={() => sendText(item.prompt)} className="whitespace-nowrap rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] px-3 py-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary)/.55)] hover:text-[hsl(var(--foreground))]" data-testid={`button-followup-${index}`}>{item.label}</button>)}
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-[0_10px_28px_hsl(var(--foreground)/.07)] transition-colors focus-within:border-[hsl(var(--primary)/.7)] focus-within:shadow-[0_10px_28px_hsl(var(--primary)/.12)]" data-testid="form-chat">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(); } }} placeholder="Describe the board or ask for a nudge..." rows={2} className="min-h-[58px] w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-6 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/.65)] focus:outline-none" aria-label="Message Arrow Puzzle AI" data-testid="input-chat" />
                <div className="flex items-center justify-between border-t border-[hsl(var(--border)/.7)] px-2 pt-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground)/.6)]">Enter to send · Shift + Enter for line break</span>
                  {isSending ? (
                    <button type="button" onClick={handleStop} className="flex h-9 items-center gap-2 rounded-xl bg-[hsl(var(--foreground))] px-3 text-[11px] font-bold text-[hsl(var(--background))] transition-transform hover:-translate-y-0.5" data-testid="button-stop"><Square className="h-3 w-3 fill-current" /> Stop</button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} className="flex h-9 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 text-[11px] font-bold text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-send"><Send className="h-3.5 w-3.5" /> Send</button>
                  )}
                </div>
              </form>
              <div className="mt-3 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.11em] text-[hsl(var(--muted-foreground)/.48)]"><span>Arrow Puzzle AI can make mistakes</span><span>Model adapts to your context</span></div>
            </div>
          </div>
        </div>
    </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
