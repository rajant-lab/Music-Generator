
import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-2 min-w-[140px] flex-1">
      <div className="flex justify-between items-end px-1">
          <label htmlFor={label} className="text-[10px] uppercase font-bold text-white/60 tracking-wider">
            {label}
          </label>
          <span className="text-xs text-white/90 font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/5 shadow-sm">
            {value.toFixed(label === 'BPM' ? 0 : 1)}
          </span>
      </div>
      
      <div className="relative h-6 flex items-center group">
          {/* Glass Track */}
          <div className="absolute w-full h-1.5 bg-white/5 rounded-full border border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] overflow-hidden">
               {/* Fill */}
               <div 
                className="h-full bg-white/20 absolute left-0 top-0 transition-all duration-75"
                style={{ width: `${((value - min) / (max - min)) * 100}%` }}
               ></div>
          </div>
          
          <input
            id={label}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full absolute z-10 opacity-0 cursor-pointer h-full"
          />
          
          {/* Custom Glowing Thumb */}
          <div 
            className="absolute h-4 w-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5),0_2px_5px_rgba(0,0,0,0.3)] border border-white/50 pointer-events-none transition-transform duration-75 group-hover:scale-110"
            style={{ 
                left: `calc(${((value - min) / (max - min)) * 100}% - 8px)`
            }}
          ></div>
      </div>
    </div>
  );
};

export default Slider;
