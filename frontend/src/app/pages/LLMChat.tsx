import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Plus, Menu, Trash2, Settings } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export function LLMChat() {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/llm/conversations').then(r => r.data.data.conversations),
    staleTime: 30_000,
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/llm', {
        message,
        conversationId,
      }).then(r => r.data.data),
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        timestamp: data.timestamp,
      }]);
    },
    onError: (error) => {
      const apiMessage = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined)
        : undefined;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: apiMessage || 'Sorry, I encountered an error. Please try again.',
      }]);
    },
  });

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString(),
    }]);

    chatMutation.mutate(userMsg);
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
  };

  const deleteConversation = async (convId: string) => {
    try {
      await api.delete(`/llm/conversations/${convId}`);
      // Refetch conversations
      if (conversationId === convId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Failed to delete conversation', error);
    }
  };

  return (
    <div className="flex w-full h-full bg-white overflow-hidden">
      {/* Conversations Sidebar - Compact */}
      <aside
        style={{
          width: sidebarOpen ? '260px' : '0px',
          transition: 'width 0.2s ease-in-out',
          minWidth: 0,
        }}
        className="bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-medium transition-all text-sm">
            <Plus className="w-4 h-4" />
            New Chat
          </motion.button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No conversations</p>
          ) : (
            conversations.map(conv => (
              <motion.div
                key={conv.id}
                whileHover={{ x: 2 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm group ${
                  conversationId === conv.id
                    ? 'bg-[#2E7D32] text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => {
                  setConversationId(conv.id);
                  setMessages([]);
                }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs">{conv.title}</p>
                  <p className="text-xs text-gray-500">{conv.message_count} msg</p>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))
          )}
        </div>

        {/* Settings */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-all text-sm">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-white to-gray-50 h-full">
        {/* Header with toggle button */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3 bg-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
            <p className="text-xs text-gray-500">Powered by Google Gemini</p>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 md:p-6 w-full">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Welcome to AgroMind AI</h2>
                <p className="text-gray-600 mb-6 text-base md:text-lg">
                  Ask me anything about agriculture, technology, or general knowledge. I'm powered by Google's Gemini AI.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-w-3xl mx-auto">
                  <button
                    onClick={() => setInput('How can I improve crop yield?')}
                    className="text-left px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg hover:border-[#2E7D32] hover:bg-green-50 text-xs md:text-sm text-gray-700 font-medium transition-all">
                    <div className="text-lg mb-1">📚</div>
                    Improve crop yield
                  </button>
                  <button
                    onClick={() => setInput('What are government farming schemes?')}
                    className="text-left px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg hover:border-[#2E7D32] hover:bg-green-50 text-xs md:text-sm text-gray-700 font-medium transition-all">
                    <div className="text-lg mb-1">🏛️</div>
                    Gov schemes
                  </button>
                  <button
                    onClick={() => setInput('How do I use AI in agriculture?')}
                    className="text-left px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg hover:border-[#2E7D32] hover:bg-green-50 text-xs md:text-sm text-gray-700 font-medium transition-all">
                    <div className="text-lg mb-1">🤖</div>
                    AI in farming
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#2E7D32] flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-xl rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm leading-relaxed shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-gray-100 text-gray-800 rounded-bl-none'
                      : 'bg-[#2E7D32] text-white rounded-br-none'
                  }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none 
                      [&_*]:my-0 [&_p]:mb-1 md:[&_p]:mb-2 [&_ul]:my-1 md:[&_ul]:my-2 [&_ol]:my-1 md:[&_ol]:my-2 [&_li]:mb-0.5 md:[&_li]:mb-1 
                      [&_strong]:font-semibold [&_em]:italic
                      [&_h1]:text-base md:[&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-1 md:[&_h1]:my-2 
                      [&_h2]:text-sm md:[&_h2]:text-base [&_h2]:font-bold [&_h2]:my-1 
                      [&_a]:text-blue-600 [&_a]:underline">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div>{msg.content}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {chatMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 md:gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#2E7D32] flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                AI
              </div>
              <div className="bg-gray-100 rounded-xl rounded-bl-none px-3 md:px-4 py-2 md:py-3 shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#2E7D32]"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="border-t border-gray-200 bg-white px-4 md:px-6 py-3 flex-shrink-0 w-full">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask anything..."
              className="flex-1 border-2 border-gray-300 rounded-full px-3 md:px-4 py-2 md:py-2.5 focus:outline-none focus:border-[#2E7D32] text-xs md:text-sm transition-all font-medium"
              disabled={chatMutation.isPending}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!input.trim() || chatMutation.isPending}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md">
              {chatMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Powered by Google Gemini
          </p>
        </div>
      </div>
    </div>
  );
}
