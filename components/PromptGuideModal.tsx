
import React from 'react';

interface PromptGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PromptGuideModal: React.FC<PromptGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-guide-title"
    >
      <div 
        className="bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-8 w-full max-w-lg text-white transform transition-all relative overflow-hidden group"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glossy overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        
        {/* Decorative background blob for the modal */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500/20 rounded-full filter blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/20 rounded-full filter blur-[80px] pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h2 id="prompt-guide-title" className="text-2xl font-light tracking-wide text-white drop-shadow-md">
            Prompting <span className="font-semibold">Guide</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="Close prompt guide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/70" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 text-white/80 text-sm font-light relative z-10 leading-relaxed max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-white/90 text-base">
            Crafting the perfect sound is art. Combine <span className="text-cyan-200 font-medium">genre</span>, <span className="text-cyan-200 font-medium">mood</span>, and <span className="text-cyan-200 font-medium">instruments</span> to guide the AI.
          </p>
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Key Ingredients
            </h3>
            <div className="grid grid-cols-1 gap-3">
               <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                   <div className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_5px_rgba(45,212,191,0.8)]"></div>
                   <span><strong className="text-white font-medium">Genre:</strong> Lo-fi, Cinematic, Deep House</span>
               </div>
               <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                   <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                   <span><strong className="text-white font-medium">Mood:</strong> Energetic, Melancholic, Ethereal</span>
               </div>
               <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                   <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.8)]"></div>
                   <span><strong className="text-white font-medium">Sound:</strong> Grand Piano, 808 Bass, Synth</span>
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Inspiration
            </h3>
            <div className="space-y-3">
                <div className="bg-white/5 border border-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 backdrop-blur-sm shadow-sm cursor-default">
                    <p className="italic text-cyan-100">"Upbeat funk with a slap bass line, brass section stabs, and a disco drum beat at 120 BPM"</p>
                </div>
                <div className="bg-white/5 border border-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 backdrop-blur-sm shadow-sm cursor-default">
                    <p className="italic text-purple-100">"Ambient space synth soundscape with slow sweeping pads and light twinkling bells, very reverb heavy"</p>
                </div>
                <div className="bg-white/5 border border-white/5 hover:bg-white/10 transition-colors rounded-xl p-4 backdrop-blur-sm shadow-sm cursor-default">
                    <p className="italic text-blue-100">"Soothing orchestral piece with cello solos, soft strings, and a slow waltz rhythm"</p>
                </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex justify-end">
            <button 
                onClick={onClose}
                className="px-8 py-3 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
                Start Creating
            </button>
        </div>
      </div>
    </div>
  );
};

export default PromptGuideModal;
