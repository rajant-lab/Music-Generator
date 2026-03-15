
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MusicNoteIcon } from './Icons';

interface MultiSelectProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedOptions, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggleOption = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  const removeOption = (e: React.MouseEvent, option: string) => {
      e.stopPropagation();
      onChange(selectedOptions.filter(o => o !== option));
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full md:w-auto" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-w-[200px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-md transition-all rounded-xl px-5 py-3 text-left flex justify-between items-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group ${isOpen ? 'ring-1 ring-white/30 bg-white/10' : ''}`}
      >
        <span className="truncate text-white/90 font-medium text-sm flex items-center gap-3">
            <span className="text-white/50 group-hover:text-white transition-colors"><MusicNoteIcon /></span>
            {selectedOptions.length === 0 ? 'Select instruments...' : `${selectedOptions.length} selected`}
        </span>
        <div className={`transition-transform duration-200 text-white/50 group-hover:text-white ${isOpen ? 'rotate-180' : ''}`}>
           <ChevronDownIcon />
        </div>
      </button>

      {/* Selected items display - Glass Chips */}
      {selectedOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
              {selectedOptions.map(option => (
                  <span key={option} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)] backdrop-blur-sm animate-fade-in-up hover:bg-white/20 transition-colors">
                      {option}
                      <button 
                        onClick={(e) => removeOption(e, option)}
                        disabled={disabled}
                        className="text-white/50 hover:text-white focus:outline-none transition-colors"
                      >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </span>
              ))}
          </div>
      )}

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[240px] mt-2 bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto custom-scrollbar animate-fade-in origin-top-left left-0">
          <div className="p-2 space-y-1">
            {options.map((option) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <div
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`px-4 py-3 rounded-xl text-sm cursor-pointer flex items-center justify-between group transition-all ${
                    isSelected 
                        ? 'bg-white/10 text-white shadow-inner' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="font-medium tracking-wide">{option}</span>
                  {isSelected && (
                    <span className="text-cyan-300 drop-shadow-[0_0_5px_rgba(103,232,249,0.5)]">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
