import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, Bot, User, Loader2, Upload, Image as ImageIcon, Stethoscope } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AIDoctor } from '../components/AIDoctor';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', flag: '🇮🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
];

const GREETING: Record<string, string> = {
  en: "Namaste! 🙏 I'm AgroMind AI Doctor. Ask me anything about your crops — disease treatment, fertilizers, government schemes, or anything else. I'm here to help you protect your harvest!",
  hi: "नमस्ते! 🙏 मैं AgroMind AI डॉक्टर हूं। अपनी फसल के बारे में कुछ भी पूछें — बीमारी, खाद, सरकारी योजनाएं। मैं आपकी फसल बचाने के लिए यहां हूं!",
  mr: "नमस्कार! 🙏 मी AgroMind AI डॉक्टर आहे. तुमच्या पिकाबद्दल काहीही विचारा — रोग, खत, सरकारी योजना. मी तुमच्या पिकाचे संरक्षण करण्यासाठी इथे आहे!",
};

export function AIDoctorChat() {
  const { user } = useAuth();
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: GREETING.en, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showAIDoctor, setShowAIDoctor] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Update greeting when language changes
    setMessages([{ role: 'assistant', content: GREETING[language], timestamp: new Date() }]);
  }, [language]);

  const { data: quickReplies = [] } = useQuery<string[]>({
    queryKey: ['quick-replies', language],
    queryFn: () => api.get(`/chat/quick-replies?language=${language}`).then(r => r.data.data),
    staleTime: 60_000,
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/chat', {
        message,
        language,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      }).then(r => r.data.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      }]);
      // ✅ NO AUTO-SPEAK - User controls voice output with Listen button
    },
    onError: (error) => {
      const apiMessage = axios.isAxiosError(error)
        ? (error.response?.data?.message as string | undefined)
        : undefined;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'hi'
          ? (apiMessage || 'माफ करें, कुछ गड़बड़ हुई। कृपया दोबारा कोशिश करें।')
          : language === 'mr'
          ? (apiMessage || 'माफ करा, काही चूक झाली. कृपया पुन्हा प्रयत्न करा.')
          : (apiMessage || 'Sorry, something went wrong. Please try again.'),
        timestamp: new Date(),
      }]);
    },
  });

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg && !uploadedImage) return;
    
    // If there's an image, send it with a message
    if (uploadedImage) {
      const imgMsg = msg || '🔍 Here is my leaf image - please diagnose any diseases and provide treatment plan';
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: `[Image uploaded] ${imgMsg}`,
        timestamp: new Date() 
      }]);
      
      // Send image to backend
      const formData = new FormData();
      formData.append('image', uploadedImage);
      formData.append('message', imgMsg);
      formData.append('language', language);
      formData.append('history', JSON.stringify(messages.slice(-10).map(m => ({ role: m.role, content: m.content }))));
      
      api.post('/chat/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: r.data.data.reply,
          timestamp: new Date(),
        }]);
      }).catch(error => {
        const apiMessage = axios.isAxiosError(error)
          ? (error.response?.data?.message as string | undefined)
          : undefined;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'hi'
            ? (apiMessage || 'माफ करें, छवि विश्लेषण विफल रहा। कृपया दोबारा कोशिश करें।')
            : language === 'mr'
            ? (apiMessage || 'माफ करा, प्रतिमा विश्लेषण अयोग्य. कृपया पुन्हा प्रयत्न करा.')
            : (apiMessage || 'Sorry, image analysis failed. Please try again.'),
          timestamp: new Date(),
        }]);
      });
      
      setUploadedImage(null);
      setImagePreview(null);
      setInput('');
      return;
    }
    
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);
    setInput('');
    chatMutation.mutate(msg);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const speakText = (text: string, lang: string, messageIndex?: number) => {
    if (!('speechSynthesis' in window)) return;
    
    // If already speaking the same message, stop it
    if (speakingMessageIndex === messageIndex && isSpeaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageIndex(null);
      setIsSpeaking(false);
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    setSpeakingMessageIndex(messageIndex ?? null);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Please use Chrome.');
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SR();
    recognition.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col h-[calc(100vh-60px)]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#2E7D32] rounded-2xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AgroMind AI Doctor</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Smart Farming Assistant
              </p>
            </div>
          </div>
          {/* Language selector */}
          <div className="flex gap-1">
            {LANGUAGE_OPTIONS.map(l => (
              <button key={l.code} onClick={() => setLanguage(l.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${language === l.code ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-[#2E7D32]' : 'bg-[#1565C0]'}`}>
                {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[80%] group relative ${msg.role === 'user' ? 'items-end' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-card border border-border rounded-tl-none'
                    : 'bg-[#2E7D32] text-white rounded-tr-none'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_*]:my-0 [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:mb-1 [&_strong]:font-semibold [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-2 [&_h3]:font-bold [&_h3]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div>{msg.content}</div>
                  )}
                </div>
        {msg.role === 'assistant' && (
                  <button 
                    onClick={() => speakText(msg.content, language, messages.indexOf(msg))}
                    className={`mt-1 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-all ${
                      speakingMessageIndex === messages.indexOf(msg) && isSpeaking
                        ? 'text-red-500 hover:text-red-600'
                        : 'text-muted-foreground hover:text-[#2E7D32]'
                    }`}>
                    {speakingMessageIndex === messages.indexOf(msg) && isSpeaking ? (
                      <>
                        <Volume2 className="w-3 h-3 animate-pulse" /> Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" /> Listen
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2E7D32] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-[#2E7D32]"
                    animate={{ y: [0,-6,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {quickReplies.length > 0 && messages.length <= 2 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {quickReplies.slice(0, 4).map((qr: string, i: number) => (
            <button key={i} onClick={() => sendMessage(qr)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#2E7D32] text-[#2E7D32] hover:bg-[#E8F5E9] transition-all">
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="bg-card rounded-2xl border border-border p-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={language === 'hi' ? 'अपना सवाल यहां लिखें...' : language === 'mr' ? 'तुमचा प्रश्न इथे लिहा...' : 'Ask anything about your crops...'}
          rows={1}
          className="flex-1 bg-transparent resize-none focus:outline-none text-sm py-1"
          style={{ maxHeight: '100px', overflowY: 'auto' }}
        />
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${uploadedImage ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-[#E8F5E9] hover:text-[#2E7D32]'}`}
            title="Upload leaf image">
            {uploadedImage ? <ImageIcon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          </button>
          <button
            onClick={isListening ? stopListening : startListening}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-muted text-muted-foreground hover:bg-[#E8F5E9] hover:text-[#2E7D32]'}`}
            title="Voice input">
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !uploadedImage) || chatMutation.isPending}
            className="w-9 h-9 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50">
            {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="mt-2 relative w-full">
          <div className="inline-block rounded-lg overflow-hidden border-2 border-[#2E7D32]">
            <img src={imagePreview} alt="Uploaded leaf" className="h-32 w-32 object-cover" />
            <button
              onClick={() => {
                setUploadedImage(null);
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
              ✕
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Leaf image ready to analyze</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center mt-2">
        {language === 'hi' ? 'हिन्दी, मराठी, English में बात करें' : language === 'mr' ? 'हिन्दी, मराठी, English मध्ये बोला' : 'Speak in Hindi, Marathi, or English'}
      </p>

      {/* AI Doctor Modal */}
      <AnimatePresence>
        {showAIDoctor && selectedScanId && (
          <AIDoctor 
            scanId={selectedScanId} 
            language={language as 'en' | 'hi' | 'mr'}
            onClose={() => {
              setShowAIDoctor(false);
              setSelectedScanId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
