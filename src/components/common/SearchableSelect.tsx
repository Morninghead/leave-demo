import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function SearchableSelect({
    value,
    options,
    onChange,
    placeholder = 'Select...',
    className = '',
    disabled = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Find selected option
    const selectedOption = options.find(o => o.value === value);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Filter options
    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const lower = search.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(lower));
    }, [options, search]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                        setSearch(''); // Reset search when opening
                    }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-400' : 'hover:bg-gray-50 text-gray-900'
                    }`}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-500' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top shadow-2xl ring-1 ring-black/5">
                    {/* Search Header */}
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white rounded-t-lg z-10">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
                                placeholder="Search..."
                                onClick={(e) => e.stopPropagation()}
                            />
                            {search && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSearch('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded-full text-gray-400"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-gray-500 text-center">
                                No results found
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between group ${value === option.value
                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {value === option.value && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

