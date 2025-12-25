import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, MessageSquare, Menu, BookOpen, AlertCircle, RefreshCw, Save, Folder, Trash2, ChevronRight, Check, X, Plus } from 'lucide-react';
import { UploadedFile, Message, Role, ChatState, KnowledgeBase } from './types';
import { FileUpload } from './components/FileUpload';
import { MessageBubble } from './components/MessageBubble';
import { CostWidget } from './components/CostWidget';
import { createChatSession, sendMessageStream, estimateTokenCount, buildSystemInstruction } from './services/geminiService';
import { Chat } from '@google/genai';

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [savedKBs, setSavedKBs] = useState<KnowledgeBase[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  
  // Save UI State
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    streamingText: '',
    totalInputTokens: 0,
    totalOutputTokens: 0,
  });

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved KBs from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('smartsdk_kbs');
    if (saved) {
      try {
        setSavedKBs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved KBs", e);
      }
    }
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, chatState.streamingText]);

  const handleStartSession = async () => {
    if (files.length === 0) return;

    try {
      setChatState(prev => ({ ...prev, isLoading: true }));
      
      // Combine all file contents into one context string
      const knowledgeBase = files.map(f => `--- Document: ${f.name} ---\n${f.content}\n`).join('\n');
      
      // Estimate initial tokens (cost of context injection)
      const systemInstruction = buildSystemInstruction(knowledgeBase);
      const initialInputTokens = await estimateTokenCount(systemInstruction);

      const chat = await createChatSession(knowledgeBase);
      setChatInstance(chat);
      setSessionActive(true);
      
      // Add initial greeting
      setChatState(prev => ({
        ...prev,
        messages: [{
          id: 'init',
          role: Role.MODEL,
          text: `Hello! I've analyzed your ${files.length} document(s). I'm ready to answer questions specifically about this knowledge base. How can I help you?`,
          timestamp: new Date()
        }],
        isLoading: false,
        streamingText: '',
        totalInputTokens: initialInputTokens, // Initialize with the context size
        totalOutputTokens: 0,
      }));
    } catch (error: any) {
      console.error("Failed to start session", error);
      const msg = error.message || "Failed to initialize the AI session.";
      alert(msg);
      setChatState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleReset = () => {
    setSessionActive(false);
    setChatInstance(null);
    setChatState({
      messages: [],
      isLoading: false,
      streamingText: '',
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    // Keep files loaded
  };

  // Reset workspace fully
  const handleCreateNew = () => {
    // Intentionally removed confirm dialog here to prevent blocking issues reported by user.
    // Switching to "Create New" implies a fresh start.
    
    setFiles([]);
    setShowSaveInput(false);
    setSaveName('');
    setSessionActive(false);
    setChatInstance(null);
    setChatState({
      messages: [],
      isLoading: false,
      streamingText: '',
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    
    setActiveTab('upload');
  };

  // Clear workspace files only
  const handleClearWorkspace = () => {
    if (confirm("Are you sure you want to clear all files?")) {
        setFiles([]);
        setShowSaveInput(false);
        setSaveName('');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !chatInstance || chatState.isLoading) return;

    const userMsgText = inputMessage.trim();
    setInputMessage('');

    // Add User Message
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: userMsgText,
      timestamp: new Date()
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, newUserMsg],
      isLoading: true,
      streamingText: '' // Prepare for stream
    }));

    try {
      // Send to Gemini and handle stream
      let fullResponse = "";
      
      const response = await sendMessageStream(chatInstance, userMsgText, (chunk) => {
        setChatState(prev => ({
          ...prev,
          streamingText: prev.streamingText + chunk
        }));
        fullResponse += chunk;
      });

      // Stream complete, finalize message and update tokens
      const newBotMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: fullResponse,
        timestamp: new Date()
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, newBotMsg],
        isLoading: false,
        streamingText: '',
        totalInputTokens: prev.totalInputTokens + (response.usage?.promptTokenCount || 0),
        totalOutputTokens: prev.totalOutputTokens + (response.usage?.candidatesTokenCount || 0),
      }));

    } catch (error: any) {
      const errorText = error.message || "I encountered an error connecting to the support system.";
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: Role.MODEL,
        text: errorText,
        timestamp: new Date(),
        isError: true
      };
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
        isLoading: false,
        streamingText: ''
      }));
    }
  };

  // --- KB Management ---
  
  const handleInitiateSave = () => {
    if (files.length === 0) return;
    setSaveName(`SDK Docs - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    setShowSaveInput(true);
  };

  const handleConfirmSave = () => {
    if (!saveName.trim()) {
      alert("Please enter a name for the Knowledge Base.");
      return;
    }

    try {
      const newKB: KnowledgeBase = {
        id: Date.now().toString(),
        name: saveName.trim(),
        createdAt: Date.now(),
        files: [...files] // deep enough copy for this structure
      };

      // Create update array
      const updatedKBs = [...savedKBs, newKB];
      
      // Try to save to localStorage FIRST to catch quota errors
      localStorage.setItem('smartsdk_kbs', JSON.stringify(updatedKBs));
      
      // If successful, update state
      setSavedKBs(updatedKBs);
      
      // Reset UI and Switch Tab
      setShowSaveInput(false);
      setSaveName('');
      alert("Knowledge Base saved successfully!");
      setActiveTab('library');

    } catch (error: any) {
      console.error("Error saving KB:", error);
      // Handle QuotaExceededError specially
      if (error.name === 'QuotaExceededError' || error.message?.toLowerCase().includes('quota')) {
        alert("Cannot save Knowledge Base: Storage limit exceeded.\n\nBrowser local storage is limited (usually ~5MB). Please try removing old Knowledge Bases or uploading fewer/smaller files.");
      } else {
        alert("Failed to save Knowledge Base. Please try again.");
      }
    }
  };
  
  const handleCancelSave = () => {
      setShowSaveInput(false);
      setSaveName('');
  };

  const handleLoadKB = (kb: KnowledgeBase) => {
    if (sessionActive) {
      if (!confirm("Loading a new Knowledge Base will reset your current chat session. Continue?")) return;
      handleReset();
    }
    setFiles(kb.files);
    setActiveTab('upload');
  };

  const handleDeleteKB = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this Knowledge Base?")) return;
    
    try {
      const updated = savedKBs.filter(kb => kb.id !== id);
      // Update localStorage first
      localStorage.setItem('smartsdk_kbs', JSON.stringify(updated));
      // Then update state
      setSavedKBs(updated);
    } catch (error) {
      console.error("Error deleting KB:", error);
      alert("Failed to delete Knowledge Base.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* Sidebar - Configuration */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full'
        } fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-xl md:relative md:shadow-none md:translate-x-0 ${!isSidebarOpen && 'md:w-0 md:overflow-hidden'}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h1 className="font-bold text-slate-800">SmartSDK Docs</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-slate-100">
           <button 
             onClick={() => setActiveTab('upload')}
             className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
               activeTab === 'upload' 
                ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
             }`}
           >
             <Settings className="w-4 h-4" />
             <span>Config</span>
           </button>
           <button 
             onClick={() => setActiveTab('library')}
             className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
               activeTab === 'library' 
                ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
             }`}
           >
             <Folder className="w-4 h-4" />
             <span>Saved KBs</span>
           </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* TAB: UPLOAD / CONFIG */}
          {activeTab === 'upload' && (
            <div className="flex flex-col h-full p-4 overflow-hidden">
                <div className="mb-4 text-xs text-slate-500 bg-blue-50 p-3 rounded border border-blue-100 flex-shrink-0">
                  <p className="font-semibold text-blue-700 mb-1">Step 1: Upload Documents</p>
                  Upload your SDK documentation (.md, .txt, .json). These files form the "Knowledge Base".
                </div>
                
                {/* Wrap FileUpload in flex-1 min-h-0 so it scrolls independently */}
                <div className="flex-1 min-h-0 mb-3">
                  <FileUpload 
                    files={files} 
                    setFiles={setFiles} 
                    disabled={sessionActive}
                    onClear={handleClearWorkspace}
                  />
                </div>

                {/* Save Section */}
                {files.length > 0 && (
                   <div className="flex-shrink-0">
                     {!showSaveInput ? (
                        <button 
                          onClick={handleInitiateSave}
                          className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-colors flex items-center justify-center space-x-2 shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save as Knowledge Base</span>
                        </button>
                     ) : (
                        <div className="bg-slate-50 p-3 rounded-lg border border-blue-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                           <label className="block text-xs font-semibold text-blue-800 mb-2">Name your Knowledge Base:</label>
                           <input 
                              type="text" 
                              autoFocus
                              value={saveName}
                              onChange={(e) => setSaveName(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-300 rounded mb-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                           />
                           <div className="flex space-x-2">
                              <button 
                                onClick={handleConfirmSave}
                                className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
                              >
                                <Check className="w-3 h-3 mr-1" /> Save
                              </button>
                              <button 
                                onClick={handleCancelSave}
                                className="flex-1 bg-white border border-slate-300 text-slate-600 text-xs py-1.5 rounded hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                           </div>
                        </div>
                     )}
                   </div>
                )}
            </div>
          )}

          {/* TAB: LIBRARY */}
          {activeTab === 'library' && (
            <div className="flex flex-col h-full p-4 overflow-y-auto">
               <button 
                 onClick={handleCreateNew}
                 className="mb-4 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center space-x-2"
               >
                 <Plus className="w-4 h-4" />
                 <span>Create New Knowledge Base</span>
               </button>

               <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Saved Configurations</h3>
               {savedKBs.length === 0 ? (
                 <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-100 rounded-lg">
                   <Folder className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                   No saved knowledge bases yet. <br/>
                   Upload files in the Config tab and save them here.
                 </div>
               ) : (
                 <ul className="space-y-3">
                   {savedKBs.map(kb => (
                     <li 
                      key={kb.id} 
                      onClick={() => handleLoadKB(kb)}
                      className="group bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all relative"
                     >
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-slate-700 group-hover:text-blue-700 transition-colors truncate pr-6">{kb.name}</h4>
                          <button 
                            onClick={(e) => handleDeleteKB(kb.id, e)}
                            className="text-slate-300 hover:text-red-500 transition-colors absolute top-3 right-3"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                       <div className="flex items-center text-xs text-slate-400 space-x-3">
                          <span className="flex items-center">
                            <BookOpen className="w-3 h-3 mr-1" /> {kb.files.length} files
                          </span>
                          <span>
                            {new Date(kb.createdAt).toLocaleDateString()}
                          </span>
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          )}

        </div>

        {/* Cost Widget fixed area */}
        <div className="px-4 pb-2 bg-slate-50 border-t border-slate-100 pt-3">
             <CostWidget 
                inputTokens={chatState.totalInputTokens} 
                outputTokens={chatState.totalOutputTokens} 
              />
        </div>

        <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50">
          {!sessionActive ? (
            <button
              onClick={handleStartSession}
              disabled={files.length === 0}
              className={`w-full py-2.5 px-4 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center space-x-2 ${
                files.length === 0 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
              }`}
            >
              <span>Initialize Knowledge Base</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-lg font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset & Update Docs</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative w-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mr-4 p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-semibold text-slate-800 flex items-center">
                Technical Support Agent
                <span className={`ml-2 w-2 h-2 rounded-full ${sessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
              </h2>
              <span className="text-xs text-slate-400">
                {sessionActive ? 'Connected to Knowledge Base' : 'Waiting for configuration...'}
              </span>
            </div>
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            
            {/* Empty State */}
            {!sessionActive && (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <MessageSquare className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Welcome to Smart Support</h3>
                <p className="text-slate-500 max-w-md">
                  Please upload your SDK documentation in the sidebar and click "Initialize Knowledge Base" to start the intelligent support session.
                </p>
              </div>
            )}

            {/* Messages */}
            {sessionActive && (
              <div className="flex flex-col pb-4 min-h-0">
                {chatState.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                
                {/* Streaming Message (Ghost bubble) */}
                {chatState.isLoading && chatState.streamingText && (
                  <MessageBubble 
                    message={{
                      id: 'streaming',
                      role: Role.MODEL,
                      text: chatState.streamingText,
                      timestamp: new Date()
                    }} 
                  />
                )}

                {/* Loading Indicator (before stream starts) */}
                {chatState.isLoading && !chatState.streamingText && (
                  <div className="flex justify-start mb-6 animate-pulse">
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none text-slate-400 text-sm flex items-center space-x-2">
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-4xl mx-auto">
            {sessionActive ? (
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask a question about the SDK..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-slate-700 placeholder-slate-400"
                  disabled={chatState.isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatState.isLoading}
                  className={`absolute right-2 p-2 rounded-lg transition-colors ${
                    !inputMessage.trim() || chatState.isLoading
                      ? 'text-slate-300' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            ) : (
                <div className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Upload documents and initialize the session to start chatting.
                </div>
            )}
          </div>
          <div className="text-center mt-2">
             <p className="text-[10px] text-slate-400">
               AI can make mistakes. Please verify important technical details.
             </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;