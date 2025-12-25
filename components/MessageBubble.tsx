import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role } from '../types';
import { Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-emerald-600'
        }`}>
          {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
        </div>

        {/* Bubble */}
        <div className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser 
            ? 'bg-blue-600 text-white rounded-tr-none' 
            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
        }`}>
            {message.isError ? (
                <div className="text-red-200 font-medium">
                    {message.text}
                </div>
            ) : (
                <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
                    <ReactMarkdown
                        components={{
                            code({node, className, children, ...props}) {
                                return (
                                    <code className={`${className} ${isUser ? 'bg-blue-700' : 'bg-slate-100'} rounded px-1 py-0.5`} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            pre({node, children, ...props}) {
                                return (
                                    <pre className={`${isUser ? 'bg-blue-800' : 'bg-slate-900'} text-slate-50 p-3 rounded-md overflow-x-auto`} {...props}>
                                        {children}
                                    </pre>
                                )
                            },
                            a({node, children, ...props}) {
                                return (
                                    <a className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noreferrer" {...props}>
                                        {children}
                                    </a>
                                )
                            }
                        }}
                    >
                        {message.text}
                    </ReactMarkdown>
                </div>
            )}
            <div className={`text-[10px] mt-1 ${isUser ? 'text-blue-200' : 'text-slate-400'} text-right`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
      </div>
    </div>
  );
};