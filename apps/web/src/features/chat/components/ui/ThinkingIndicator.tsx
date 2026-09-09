import { useState, useEffect } from 'react';
import './ThinkingIndicator.css';

const PHRASES = ['Thinking', 'Processing', 'Working'];
const CYCLE_MS = 2400;

export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setFading(false);
      }, 300);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="thinking-indicator">
      <div className="thinking-indicator-content">
        <span className={`thinking-text ${fading ? 'fade-out' : 'fade-in'}`}>
          {PHRASES[index]}
        </span>
        <div className="thinking-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
}
