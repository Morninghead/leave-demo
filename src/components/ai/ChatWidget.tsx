/**
 * AI Chat Widget Component
 * 
 * Floating chat button with expandable chat window
 * Provides AI HR Assistant functionality
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Bot, Sparkles, Minimize2, Power } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { sendChatMessage, ChatMessage as ChatMessageType } from '../../api/ai';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { updateSettings } from '../../api/settings';
import { useToast } from '../../hooks/useToast';

interface Message extends ChatMessageType {
    id: string;
    timestamp: Date;
}

export function ChatWidget() {
    const { i18n } = useTranslation();
    const { user } = useAuth();
    const { settings, refetch } = useSettings();
    const { showToast } = useToast();

    // State
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isThai = i18n.language === 'th';
    const isDev = (user as any)?.employeeCode === '999999999' || (user as any)?.username === '999999999';

    const isAiEnabled = settings?.branding_settings?.enable_ai_widget !== false; // Default true

    const shouldRender = !isHidden && (isAiEnabled || isDev);

    const handleToggleSystemAi = async () => {
        if (!settings) return;

        try {
            const newStatus = !isAiEnabled;
            // Ensure we keep existing branding settings
            const currentBranding = settings.branding_settings || {
                logo: {
                    type: 'icon',
                    backgroundColor: '#2563eb',
                    width: 64,
                    height: 64,
                    rounded: 'lg'
                },
                primaryColor: '#2563eb'
            };

            await updateSettings({
                branding_settings: {
                    ...currentBranding,
                    enable_ai_widget: newStatus
                }
            });

            await refetch();

            showToast(
                isThai
                    ? `AI Widget ${newStatus ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว (System)'}`
                    : `AI Widget ${newStatus ? 'Enabled' : 'Disabled (System-wide)'}`,
                'success'
            );
        } catch (error) {
            console.error('Failed to toggle AI widget:', error);
            showToast('Failed to update settings', 'error');
        }
    };

    // Add welcome message when first opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'model',
                content: isThai
                    ? 'สวัสดีครับ! 👋 ผมเป็น AI HR Assistant พร้อมช่วยเหลือเรื่องการลาครับ\n\nคุณสามารถถามเรื่อง:\n• ยอดวันลาคงเหลือ\n• นโยบายการลาต่างๆ\n• วิธีขอลา\n• หรืออื่นๆ ที่เกี่ยวกับการลา'
                    : 'Hello! 👋 I\'m your AI HR Assistant, here to help with leave matters.\n\nYou can ask about:\n• Leave balance\n• Leave policies\n• How to request leave\n• Or anything about leaves',
                timestamp: new Date()
            }]);
        }
    }, [isOpen, isThai]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && !isMinimized) {
            inputRef.current?.focus();
        }
    }, [isOpen, isMinimized]);

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const history = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, content: m.content }));

            const response = await sendChatMessage(userMessage.content, history);

            const aiMessage: Message = {
                id: `ai-${Date.now()}`,
                role: 'model',
                content: response.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'model',
                content: isThai
                    ? 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
                    : 'Sorry, an error occurred. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, messages, isThai]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleOpen = () => {
        if (isMinimized) {
            setIsMinimized(false);
        } else {
            setIsOpen(!isOpen);
        }
    };

    if (!shouldRender) return null;

    if (!isOpen) {
        return (
            <button
                onClick={toggleOpen}
                className={`fixed bottom-8 right-8 z-50 w-14 h-14 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-110 ${!isAiEnabled ? 'bg-gray-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'
                    }`}
                title="AI HR Assistant"
            >
                <Bot className="w-6 h-6 group-hover:hidden" />
                <Sparkles className="w-6 h-6 hidden group-hover:block animate-pulse" />
                {isAiEnabled && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />}
                {!isAiEnabled && isDev && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full" />}
            </button>
        );
    }

    if (isMinimized) {
        return (
            <button
                onClick={toggleOpen}
                className={`fixed bottom-8 right-8 z-50 px-4 py-2 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 ${!isAiEnabled ? 'bg-gray-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'
                    }`}
            >
                <Bot className="w-5 h-5" />
                <span className="text-sm font-medium">AI Assistant {(!isAiEnabled && isDev) ? '(OFF)' : ''}</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 z-50 w-96 max-w-[calc(100vw-4rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: 'min(600px, calc(100vh - 8rem))' }}>
            <div className={`px-4 py-3 flex items-center justify-between ${!isAiEnabled ? 'bg-gray-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600'
                }`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            AI HR Assistant
                            {!isAiEnabled && isDev && <span className="text-xs bg-red-500 px-1.5 py-0.5 rounded text-white font-bold">DISABLED</span>}
                        </h3>
                        <p className="text-white/70 text-xs">
                            {isThai ? 'พร้อมช่วยเหลือ' : 'Ready to help'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isDev && (
                        <button
                            onClick={handleToggleSystemAi}
                            className={`p-1.5 rounded-lg transition-colors mr-1 ${isAiEnabled ? 'hover:bg-red-500/50 text-white' : 'bg-red-500 hover:bg-red-400 text-white'}`}
                            title={isThai
                                ? `กดเพื่อ${isAiEnabled ? 'ปิด' : 'เปิด'}ระบบ AI (Dev Setting)`
                                : `Click to ${isAiEnabled ? 'Disable' : 'Enable'} AI System`}
                        >
                            <Power className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title={isThai ? 'ย่อ' : 'Minimize'}
                    >
                        <Minimize2 className="w-4 h-4 text-white" />
                    </button>

                    <button
                        onClick={() => setIsHidden(true)}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title={isThai ? 'ปิดหน้าต่าง' : 'Close Widget'}
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {!isAiEnabled && isDev && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 text-center mb-4">
                        ⚠️ AI System is currently DISABLED.<br />
                        Only Developers can see this widget.
                    </div>
                )}

                {messages.map(msg => (
                    <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        timestamp={msg.timestamp}
                    />
                ))}
                {isLoading && (
                    <ChatMessage
                        role="model"
                        content=""
                        isTyping
                    />
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t bg-white">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isThai ? 'พิมพ์ข้อความ...' : 'Type a message...'}
                        className="flex-1 px-4 py-2.5 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
                        disabled={isLoading || !isAiEnabled}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading || !isAiEnabled}
                        className={`p-2.5 text-white rounded-full transition-all ${!inputValue.trim() || isLoading || !isAiEnabled
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-br from-purple-600 to-indigo-600 hover:opacity-90'
                            }`}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
