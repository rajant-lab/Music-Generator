
import React, { useRef, useEffect } from 'react';

export type VisualizerMode = 'bars' | 'wave' | 'mirror' | 'pulse';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode;
  mode?: VisualizerMode;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode, mode = 'bars' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      // Create a gradient that matches the "neon" aesthetic
      const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#2dd4bf'); // Teal
      gradient.addColorStop(0.5, '#60a5fa'); // Blue
      gradient.addColorStop(1, '#c084fc'); // Purple

      if (mode === 'wave') {
        const bufferLength = analyserNode.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = gradient;
        canvasCtx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * height / 2;

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();

      } else if (mode === 'mirror') {
         const bufferLength = analyserNode.frequencyBinCount;
         const dataArray = new Uint8Array(bufferLength);
         analyserNode.getByteFrequencyData(dataArray);

         canvasCtx.fillStyle = gradient;
         const barWidth = (width / bufferLength) * 3; // Wider bars for mirror
         const centerX = width / 2;

         for (let i = 0; i < bufferLength; i++) {
             // Only draw lower half of spectrum to keep bars wide and centered
             if (i > bufferLength / 2) break;

             const barHeight = (dataArray[i] / 255) * height * 0.9;
             const y = (height - barHeight) / 2;
             
             // Draw left
             canvasCtx.fillRect(centerX - (i * barWidth) - barWidth, y, barWidth - 1, barHeight);
             // Draw right
             canvasCtx.fillRect(centerX + (i * barWidth), y, barWidth - 1, barHeight);
         }

      } else if (mode === 'pulse') {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Dynamic radius based on volume
        const radius = (height / 4) + (average / 255) * (height / 2);
        
        const centerX = width / 2;
        const centerY = height / 2;

        // Glow
        const radGradient = canvasCtx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.5);
        radGradient.addColorStop(0, 'rgba(96, 165, 250, 0.8)');
        radGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
        
        canvasCtx.fillStyle = radGradient;
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius * 1.5, 0, 2 * Math.PI);
        canvasCtx.fill();

        // Core
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        canvasCtx.strokeStyle = '#fff';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        
        // Inner particles/lines
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        canvasCtx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (Date.now() / 1000) + (i * Math.PI / 4);
            canvasCtx.beginPath();
            canvasCtx.moveTo(centerX + Math.cos(angle) * (radius * 0.5), centerY + Math.sin(angle) * (radius * 0.5));
            canvasCtx.lineTo(centerX + Math.cos(angle) * (radius * 1.2), centerY + Math.sin(angle) * (radius * 1.2));
            canvasCtx.stroke();
        }

      } else {
        // Default: 'bars'
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        canvasCtx.fillStyle = gradient;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8;
          const y = (height - barHeight) / 2; // Center vertically
          
          canvasCtx.beginPath();
          canvasCtx.roundRect(x, y, barWidth - 1, barHeight, 2);
          canvasCtx.fill();

          x += barWidth + 1;
        }
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, mode]);

  return <canvas ref={canvasRef} width="800" height="200" className="w-full h-full" />;
};

export default AudioVisualizer;
