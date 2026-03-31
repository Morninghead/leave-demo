/**
 * AI Chat Message Component
 * 
 * Individual chat bubble with support for Thai/English
 */

import React from 'react';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
    role: 'user' | 'model';
    content: string;
    timestamp?: Date;
    isTyping?: boolean;
}

export function ChatMessage({ role, content, timestamp, isTyping }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                }`}>
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message Bubble */}
            <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-2 rounded-2xl ${isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}>
                    {isTyping ? (
                        <div className="flex items-center gap-1 py-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                    )}
                </div>
                {timestamp && !isTyping && (
                    <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
                        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                )}
            </div>
        </div>
    );
}

