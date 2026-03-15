
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveMusicSession } from '@google/genai';
import { startSession, closeSession, updateMusicConfig, updatePrompt, generateSurprisePrompt } from './services/geminiService';
import { concatenateAudioBuffers, audioBufferToWav, createReverbImpulseResponse } from './utils/audioUtils';
import AudioVisualizer, { VisualizerMode } from './components/AudioVisualizer';
import { LoadingIcon, PlayIcon, StopIcon, MagicWandIcon, DownloadIcon, InfoIcon, RefreshIcon, ChevronDownIcon } from './components/Icons';
import Slider from './components/Slider';
import PromptGuideModal from './components/PromptGuideModal';
import MultiSelect from './components/MultiSelect';

type Status = 'idle' | 'connecting' | 'generating' | 'stopping' | 'error';
type EffectType = 'none' | 'reverb' | 'echo';

interface MusicConfig {
  bpm: number;
  density: number;
  brightness: number;
  guidance: number;
}

const INSTRUMENT_LIST = [
    "Piano", "Acoustic Guitar", "Electric Guitar", "Bass Guitar", "Drums", "Violin", "Cello", "Trumpet",
    "Saxophone", "Flute", "Synth Pads", "808 Bass", "Sitar", "Marimba", "Hang Drum"
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('Minimal techno with deep bass');
  const [finalPrompt, setFinalPrompt] = useState(prompt);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isProcessingDownload, setIsProcessingDownload] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  
  // Export Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [musicConfig, setMusicConfig] = useState<MusicConfig>({
    bpm: 120,
    density: 0.5,
    brightness: 0.5,
    guidance: 4.0,
  });

  const [effectType, setEffectType] = useState<EffectType>('none');
  const [effectIntensity, setEffectIntensity] = useState(0.3); // Wet/Dry mix

  const sessionRef = useRef<LiveMusicSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<AudioBuffer[]>([]);
  
  // Audio effects nodes
  const dryNodeRef = useRef<GainNode | null>(null);
  const wetNodeRef = useRef<GainNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null); // Reverb
  const delayNodeRef = useRef<DelayNode | null>(null); // Echo
  const feedbackNodeRef = useRef<GainNode | null>(null); // Echo feedback
  const masterGainNodeRef = useRef<GainNode | null>(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  const isBusy = status === 'connecting' || status === 'generating' || status === 'stopping';

  useEffect(() => {
    const url = downloadUrl;
    return () => {
        if (url) {
            URL.revokeObjectURL(url);
        }
    };
  }, [downloadUrl]);

  // Handle outside click for export menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
              setIsExportMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      sourcesRef.current.forEach(source => {
        try {
            source.stop();
        } catch (e) {
            console.warn("Could not stop source", e);
        }
      });
      sourcesRef.current.clear();
      audioContextRef.current.close().catch(console.error);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    masterGainNodeRef.current = null;
    nextStartTimeRef.current = 0;
  }, []);

  const handleStop = useCallback(async () => {
    setStatus('stopping');
    if (sessionRef.current) {
      await closeSession(sessionRef.current);
      sessionRef.current = null;
    }

    if (audioChunksRef.current.length > 0) {
        setIsProcessingDownload(true);
        try {
            const concatenatedBuffer = concatenateAudioBuffers(audioChunksRef.current);
            if (concatenatedBuffer) {
                const wavBlob = audioBufferToWav(concatenatedBuffer);
                const url = URL.createObjectURL(wavBlob);
                setDownloadUrl(url);
            }
        } catch (e) {
            console.error("Failed to create download file:", e);
            setError("Could not process audio for download.");
        } finally {
            setIsProcessingDownload(false);
        }
    }

    cleanupAudio();
    setStatus('idle');
  }, [cleanupAudio]);

  const handleGenerate = useCallback(async () => {
    if (isBusy) return;
    setError(null);
    setDownloadUrl(null);
    setStatus('connecting');
    audioChunksRef.current = [];

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
      
      // Master Gain
      masterGainNodeRef.current = audioContext.createGain();
      
      // Analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // Increased FFT size for better resolution in Wave/Mirror modes
      masterGainNodeRef.current.connect(analyser);
      analyser.connect(audioContext.destination);
      
      // Effect nodes setup
      dryNodeRef.current = audioContext.createGain();
      wetNodeRef.current = audioContext.createGain();
      dryNodeRef.current.connect(masterGainNodeRef.current);
      wetNodeRef.current.connect(masterGainNodeRef.current);
      
      // Reverb
      convolverNodeRef.current = audioContext.createConvolver();
      const impulseResponse = await createReverbImpulseResponse(audioContext);
      convolverNodeRef.current.buffer = impulseResponse;

      // Echo
      delayNodeRef.current = audioContext.createDelay(1.0); // Max 1s delay
      feedbackNodeRef.current = audioContext.createGain();
      delayNodeRef.current.connect(feedbackNodeRef.current);
      feedbackNodeRef.current.connect(delayNodeRef.current);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      nextStartTimeRef.current = 0;
      sourcesRef.current.clear();

      const newSession = await startSession({
        prompt: finalPrompt,
        config: musicConfig,
        onAudioChunk: (audioBuffer) => {
          if (!audioContextRef.current || !masterGainNodeRef.current || !dryNodeRef.current) return;
          
          audioChunksRef.current.push(audioBuffer);

          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          // Connect source to both dry and wet paths
          source.connect(dryNodeRef.current);
          source.connect(wetNodeRef.current);
          
          source.onended = () => {
            sourcesRef.current.delete(source);
          };

          const currentTime = audioContextRef.current.currentTime;
          const startTime = Math.max(currentTime, nextStartTimeRef.current);
          source.start(startTime);
          nextStartTimeRef.current = startTime + audioBuffer.duration;
          sourcesRef.current.add(source);
        },
        onOpen: () => {
          setStatus('generating');
        },
        onError: (err: ErrorEvent) => {
          console.error('Session error:', err);
          setError(`An error occurred: ${err.message}. This might be an experimental feature. Please try again.`);
          setStatus('error');
          handleStop();
        },
        onClose: (_event: CloseEvent) => {
          if (statusRef.current !== 'stopping') {
            handleStop();
          }
        },
      });
      sessionRef.current = newSession;

    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(`Failed to start session: ${err.message}`);
      setStatus('error');
      cleanupAudio();
    }
  }, [finalPrompt, isBusy, cleanupAudio, handleStop, musicConfig]);
  
  const handleSurpriseMe = async () => {
    setIsGeneratingPrompt(true);
    setError(null);
    try {
        const newPrompt = await generateSurprisePrompt();
        setPrompt(newPrompt);
    } catch (err: any) {
        setError(`Failed to generate prompt: ${err.message}`);
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  useEffect(() => {
    const instrumentText = selectedInstruments.length > 0
        ? ` with the following instruments: ${selectedInstruments.join(', ')}.`
        : '';
    setFinalPrompt(prompt + instrumentText);
  }, [prompt, selectedInstruments]);


  useEffect(() => {
    if (status === 'generating' && sessionRef.current) {
        updateMusicConfig(sessionRef.current, musicConfig);
    }
  }, [musicConfig, status]);

  useEffect(() => {
    const handler = setTimeout(() => {
        if (status === 'generating' && sessionRef.current && finalPrompt) {
            updatePrompt(sessionRef.current, finalPrompt);
        }
    }, 500); // Debounce prompt updates
    
    return () => {
        clearTimeout(handler);
    };
  }, [finalPrompt, status]);

  // Effect routing logic
  useEffect(() => {
    if (status !== 'generating' || !wetNodeRef.current || !dryNodeRef.current || !masterGainNodeRef.current) return;

    // Disconnect all wet paths first
    wetNodeRef.current.disconnect();
    convolverNodeRef.current?.disconnect();
    delayNodeRef.current?.disconnect();
    feedbackNodeRef.current?.disconnect(delayNodeRef.current);
    
    // Set gains based on intensity (wet/dry mix)
    dryNodeRef.current.gain.setValueAtTime(1 - effectIntensity, audioContextRef.current!.currentTime);
    wetNodeRef.current.gain.setValueAtTime(effectIntensity, audioContextRef.current!.currentTime);

    if (effectType === 'reverb' && convolverNodeRef.current) {
        wetNodeRef.current.connect(convolverNodeRef.current);
        convolverNodeRef.current.connect(masterGainNodeRef.current);
    } else if (effectType === 'echo' && delayNodeRef.current && feedbackNodeRef.current) {
        // Intensity controls feedback and delay time for echo
        feedbackNodeRef.current.gain.setValueAtTime(effectIntensity * 0.7, audioContextRef.current!.currentTime); // 0.7 to avoid harsh feedback
        delayNodeRef.current.delayTime.setValueAtTime(effectIntensity * 0.5 + 0.1, audioContextRef.current!.currentTime); // 0.1s to 0.6s delay
        
        wetNodeRef.current.connect(delayNodeRef.current);
        delayNodeRef.current.connect(masterGainNodeRef.current);
        feedbackNodeRef.current.connect(delayNodeRef.current);
    } else {
        // No effect, set wet gain to 0
        wetNodeRef.current.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
        dryNodeRef.current.gain.setValueAtTime(1, audioContextRef.current!.currentTime);
    }

  }, [effectType, effectIntensity, status]);

  const toggleVisualizerMode = () => {
      const modes: VisualizerMode[] = ['bars', 'wave', 'mirror', 'pulse'];
      const nextIndex = (modes.indexOf(visualizerMode) + 1) % modes.length;
      setVisualizerMode(modes[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative">
      <PromptGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-blue-600/30 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-teal-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob animation-delay-4000"></div>

      {/* Main Container - The Glass Sheet */}
      <div className="w-full max-w-4xl relative z-10 flex flex-col h-[85vh]">
        
        <div className="flex-1 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-y-auto flex flex-col relative group">
            
            {/* Glossy overlay for the whole card */}
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-0"></div>

            <header className="p-8 border-b border-white/5 flex justify-between items-start relative z-10">
               <div>
                 <h1 className="text-3xl font-light text-white tracking-tight drop-shadow-lg">Gemini <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-blue-200">Live Audio</span></h1>
                 <p className="text-blue-100/60 text-sm mt-2 font-light">AI-powered real-time music synthesis</p>
               </div>
               <button 
                  onClick={() => setIsGuideOpen(true)} 
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all hover:scale-105 backdrop-blur-md shadow-lg"
                >
                  <InfoIcon />
               </button>
            </header>

            <div className="p-8 space-y-10 flex-1 relative z-10">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-6 py-4 rounded-2xl text-sm backdrop-blur-md shadow-inner">
                        {error}
                    </div>
                )}

                {/* Prompt Input Area */}
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your sound..."
                        className="w-full bg-transparent text-4xl md:text-5xl font-medium text-white placeholder-white/20 focus:outline-none resize-none leading-tight tracking-tight drop-shadow-md"
                        rows={2}
                        disabled={isBusy}
                    />
                    <div className="absolute right-0 bottom-2">
                         <button 
                            onClick={handleSurpriseMe}
                            disabled={isBusy || isGeneratingPrompt}
                            className="text-sm text-blue-200/70 hover:text-white flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:bg-white/10 transition-all backdrop-blur-md shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
                        >
                            {isGeneratingPrompt ? <LoadingIcon /> : <MagicWandIcon />}
                            <span>Inspire Me</span>
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-8">
                    
                    {/* Instrument MultiSelect */}
                    <div className="w-full">
                        <MultiSelect 
                            options={INSTRUMENT_LIST}
                            selectedOptions={selectedInstruments}
                            onChange={setSelectedInstruments}
                            disabled={isBusy}
                        />
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                    {/* Sliders & FX */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-wrap gap-6 items-center">
                        <Slider label="BPM" min={60} max={200} step={1} value={musicConfig.bpm} onChange={v => setMusicConfig(c => ({...c, bpm: Math.round(v)}))} disabled={isBusy} />
                        <Slider label="Density" min={0} max={1} step={0.01} value={musicConfig.density} onChange={v => setMusicConfig(c => ({...c, density: v}))} disabled={isBusy} />
                        <Slider label="Guidance" min={0} max={6} step={0.1} value={musicConfig.guidance} onChange={v => setMusicConfig(c => ({...c, guidance: v}))} disabled={isBusy} />
                        
                        {/* Effect Pill - Glass style */}
                        <div className="flex items-center gap-3 bg-black/20 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/10 shadow-inner ml-auto">
                            <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">FX</span>
                            <div className="h-4 w-px bg-white/10"></div>
                            <select 
                                value={effectType}
                                onChange={e => setEffectType(e.target.value as EffectType)}
                                disabled={!isBusy}
                                className="bg-transparent text-sm font-medium text-white/90 focus:outline-none cursor-pointer [&>option]:bg-slate-900"
                            >
                                <option value="none">None</option>
                                <option value="reverb">Reverb</option>
                                <option value="echo">Echo</option>
                            </select>
                            
                            {effectType !== 'none' && (
                                <>
                                    <div className="h-4 w-px bg-white/10"></div>
                                    <input 
                                        type="range" 
                                        min={0} max={1} step={0.01} 
                                        value={effectIntensity} 
                                        onChange={e => setEffectIntensity(parseFloat(e.target.value))}
                                        className="w-16 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Floating Player Bar */}
            <div className="p-6 md:p-8 bg-transparent relative z-20 mt-auto">
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full h-24 px-8 flex items-center gap-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
                    
                    {/* Play/Stop Button with Glassmorphism */}
                    <div className="relative flex-shrink-0">
                         {/* Glowing Ring */}
                         {(status === 'generating') && (
                            <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-md animate-pulse"></div>
                         )}

                        {status === 'generating' || status === 'connecting' ? (
                             <button onClick={handleStop} className="relative z-10 w-14 h-14 bg-gradient-to-b from-red-400/80 to-red-600/80 border border-white/20 text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg backdrop-blur-md">
                                {status === 'connecting' ? <LoadingIcon /> : <StopIcon />}
                             </button>
                        ) : (
                             <button onClick={handleGenerate} disabled={!prompt} className="relative z-10 w-14 h-14 bg-gradient-to-b from-white/20 to-white/5 border border-white/40 text-white rounded-full flex items-center justify-center hover:scale-105 hover:bg-white/20 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:scale-100 disabled:shadow-none backdrop-blur-md group">
                                <div className="absolute inset-0 rounded-full bg-white/20 blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <PlayIcon />
                             </button>
                        )}
                    </div>

                    {/* Visualizer Container - Recessed Glass & Interactive */}
                    <div 
                        className="flex-1 h-12 bg-black/20 rounded-xl inner-shadow border border-white/5 overflow-hidden relative flex items-center justify-center cursor-pointer group hover:bg-black/30 transition-colors"
                        onClick={toggleVisualizerMode}
                        title="Click to switch visualizer style"
                    >
                         {status === 'generating' && analyserRef.current ? (
                            <>
                                <div className="w-full h-full opacity-80 mix-blend-screen pointer-events-none">
                                    <AudioVisualizer analyserNode={analyserRef.current} mode={visualizerMode} />
                                </div>
                                <div className="absolute bottom-1 right-3 text-[9px] uppercase font-bold tracking-widest text-white/20 group-hover:text-white/60 transition-colors pointer-events-none">
                                    {visualizerMode}
                                </div>
                            </>
                         ) : (
                             <>
                                <div className="flex items-center gap-1.5 h-6 opacity-30">
                                    {[...Array(30)].map((_, i) => (
                                        <div key={i} className="w-1 bg-white rounded-full" style={{height: `${Math.random() * 80 + 20}%`}}></div>
                                    ))}
                                </div>
                                <div className="absolute bottom-1 right-3 text-[9px] uppercase font-bold tracking-widest text-white/10 group-hover:text-white/40 transition-colors pointer-events-none">
                                    {visualizerMode}
                                </div>
                             </>
                         )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4" ref={exportMenuRef}>
                        <button 
                            onClick={handleSurpriseMe} 
                            disabled={isBusy || isGeneratingPrompt}
                            className="w-10 h-10 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all border border-transparent hover:border-white/10"
                            title="New Random Prompt"
                        >
                            <RefreshIcon />
                        </button>
                        
                        {isProcessingDownload ? (
                            <div className="w-10 h-10 flex items-center justify-center text-white/50"><LoadingIcon /></div>
                        ) : downloadUrl ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                    className={`flex items-center gap-2 px-4 py-2 ${isExportMenuOpen ? 'bg-white/20' : 'bg-white/10'} text-white rounded-full hover:bg-white/20 transition-all shadow-lg border border-white/10 backdrop-blur-md`}
                                >
                                    <DownloadIcon />
                                    <ChevronDownIcon />
                                </button>
                                
                                {isExportMenuOpen && (
                                    <div className="absolute bottom-full right-0 mb-4 w-60 bg-gray-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                                        <div className="p-2 space-y-1">
                                            <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">Download</div>
                                            
                                            <a 
                                                href={downloadUrl} 
                                                download="gemini-music.wav"
                                                className="flex items-center justify-between w-full px-4 py-3 text-sm text-white hover:bg-white/10 rounded-xl transition-colors group"
                                                onClick={() => setIsExportMenuOpen(false)}
                                            >
                                                <span>WAV <span className="text-white/40 text-xs ml-1 font-light">Lossless</span></span>
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></div>
                                            </a>
                                            
                                            <button 
                                                disabled
                                                className="flex items-center justify-between w-full px-4 py-3 text-sm text-white/30 cursor-not-allowed rounded-xl"
                                            >
                                                <span>MP3 <span className="text-white/10 text-xs ml-1">Converting...</span></span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                     </div>

                </div>
            </div>
        </div>
        
        <p className="text-center text-blue-200/40 text-xs mt-6 font-light tracking-widest uppercase">Powered by Gemini Live API</p>
      </div>
    </div>
  );
};

export default App;
