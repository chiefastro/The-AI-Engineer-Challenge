import { useState, useRef, useEffect } from 'react';
import { Spaceship } from './Spaceship';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Box-Muller transform to generate normally distributed random numbers
const normalRandom = (mean: number, stdDev: number): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
};

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [displayedAssistantMessage, setDisplayedAssistantMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wordAnimation, setWordAnimation] = useState<Array<{word: string, start: number, end: number, progress: number, x: number}>>([]);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [shipPosition, setShipPosition] = useState(400);
  const [isShipMoving, setIsShipMoving] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [showCursor, setShowCursor] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Add mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (animationContainerRef.current) {
        const containerRect = animationContainerRef.current.getBoundingClientRect();
        const relativeX = e.clientX - containerRect.left;
        const minX = 50;
        const maxX = containerRect.width - 150;
        const clampedX = Math.max(minX, Math.min(maxX, relativeX));
        setShipPosition(clampedX);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    console.log('API Key available:', !!apiKey);
    if (!apiKey) {
      setMessages([{
        role: 'assistant',
        content: 'Error: OpenAI API key is not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file.'
      }]);
    }
  }, []);

  const scrollToBottom = () => {
    if (animationContainerRef.current) {
      animationContainerRef.current.scrollTop = animationContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, displayedAssistantMessage, isLoading, input]);

  // Handle click anywhere in chat window to focus input
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (animationContainerRef.current && !isLoading) {
        const target = e.target as HTMLElement;
        // Don't focus if clicking on a link or button
        if (target.tagName === 'A' || target.tagName === 'BUTTON') return;
        
        if (inputRef.current) {
          inputRef.current.focus();
          // If clicking on the input container, calculate cursor position
          if (inputContainerRef.current?.contains(target)) {
            const rect = inputContainerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            // Approximate character position based on average character width
            const charWidth = 8; // Approximate width of a character in pixels
            const position = Math.round(x / charWidth);
            setCursorPosition(Math.min(position, input.length));
            inputRef.current.setSelectionRange(position, position);
          }
        }
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isLoading, input.length]);

  // Focus input on initial load and when messages change
  useEffect(() => {
    if (inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  // Handle input changes and cursor position
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  // Handle key navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Error: OpenAI API key is not configured. Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file.'
        }]);
        return;
      }

      const userMessage = input.trim();
      setInput('');
      setCursorPosition(0); // Reset cursor position when sending message
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setIsLoading(true);
      setDisplayedAssistantMessage('');
      setPendingWords([]);
      setShipPosition(400);
      setIsShipMoving(false);

      const requestBody = {
        user_message: userMessage,
        developer_message: "You are a helpful AI assistant.",
        api_key: apiKey,
      };

      try {
        const response = await fetch('http://localhost:8000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let buffer = '';
        let completeResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Complete API response:', completeResponse);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          completeResponse += chunk;
          buffer += chunk;
          
          const words = buffer.match(/\d+\.?\d*|\b\w+(?:['-]\w+)*\b|[.,!?;:]/g) || [];
          
          if (words.length > 0) {
            setPendingWords(prev => [...prev, ...words]);
            buffer = buffer.replace(/\d+\.?\d*|\b\w+(?:['-]\w+)*\b|[.,!?;:]/g, '');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong!' }]);
        setIsLoading(false);
      }
    }
  };

  // Process pending words when current animation completes
  useEffect(() => {
    if (pendingWords.length > 0 && !isShipMoving) {
      const nextWord = pendingWords[0];
      console.log('Processing word:', nextWord, 'Completed words:', Array.from(completedWords));
      
      // Start moving the ship
      setIsShipMoving(true);
      
      // Wait for ship to arrive (100ms transition + 17ms buffer)
      setTimeout(() => {
        setIsShipMoving(false);
        // Add word to animation using current ship position
        console.log('Adding to animation:', nextWord);
        setWordAnimation(prev => [...prev, {
          word: nextWord,
          start: Date.now(),
          end: Date.now() + 250,
          progress: 0,
          x: shipPosition // Use current ship position instead of random position
        }]);
        
        // Add word to message after animation duration
        setTimeout(() => {
          setDisplayedAssistantMessage(prev => {
            const lastChar = prev.slice(-1);
            const nextChar = nextWord[0];
            
            // Add space if:
            // 1. Previous char is not a space
            // 2. Next word is not punctuation
            // 3. Previous word doesn't end with a hyphen
            // 4. Next word doesn't start with an apostrophe
            const needsSpace = 
              lastChar !== ' ' && 
              !/^[.,!?;:]$/.test(nextWord) &&
              lastChar !== '-' &&
              nextChar !== "'";
              
            return prev + (needsSpace ? ' ' : '') + nextWord;
          });
        }, 250);
      }, 117);
      
      setPendingWords(prev => prev.slice(1));
    }
  }, [pendingWords, isShipMoving, shipPosition, completedWords]);

  // Animation frame for animating words
  useEffect(() => {
    if (wordAnimation.length === 0) return;
    
    let raf: number;
    const animate = () => {
      const now = Date.now();
      
      // Update progress for all animations
      setWordAnimation(prev => {
        const updated = prev.map(anim => {
          const duration = anim.end - anim.start;
          const progress = Math.min((now - anim.start) / duration, 1);
          return { ...anim, progress };
        });
        
        // Remove completed animations
        return updated.filter(anim => anim.progress < 1);
      });
      
      // Only continue animation if there are still words to animate
      if (wordAnimation.length > 0) {
        raf = requestAnimationFrame(animate);
      }
    };
    
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [wordAnimation]);

  // When all words are delivered, finalize the message
  useEffect(() => {
    if (isLoading && displayedAssistantMessage && wordAnimation.length === 0 && pendingWords.length === 0) {
      console.log('Finalizing message:', displayedAssistantMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: displayedAssistantMessage }]);
      setIsLoading(false);
      setDisplayedAssistantMessage('');
      setIsShipMoving(false);
      setCompletedWords(new Set()); // Reset completed words
    }
  }, [isLoading, displayedAssistantMessage, wordAnimation, pendingWords]);

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 font-mono p-4">
      <div className="relative flex flex-col flex-1 mb-2 border-2 border-green-400 rounded-lg p-4" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-y-auto" ref={animationContainerRef}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === 'user' ? 'text-blue-400' : 'text-green-400'
              }`}
            >
              <div className="font-bold mb-1">
                {message.role === 'user' ? '> User' : '> AI'}
              </div>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {/* Animated assistant message in progress */}
          {isLoading && (
            <div className="mb-4 text-green-400">
              <div className="font-bold mb-1">&gt; AI</div>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{displayedAssistantMessage}</ReactMarkdown>
              </div>
            </div>
          )}
          {/* Floating animating words */}
          {wordAnimation.map((anim, index) => animationContainerRef.current && (
            <span
              key={`${anim.word}-${index}`}
              style={{
                position: 'absolute',
                left: `${anim.x}px`,
                bottom: `${48 + (animationContainerRef.current.clientHeight - 100) * anim.progress}px`,
                transition: 'none',
                color: '#fff',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 20,
                fontSize: '1em',
                textShadow: '0 0 4px #00f0ff',
                opacity: 1 - anim.progress
              }}
            >
              {anim.word}
            </span>
          ))}
          {/* Terminal input area */}
          <div className="mt-4">
            <div className="font-bold mb-1 text-blue-400">&gt; User</div>
            <div className="relative" ref={inputContainerRef}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
                className="w-full bg-transparent text-blue-400 outline-none border-none p-0 font-mono"
                disabled={isLoading}
                style={{
                  caretColor: 'transparent',
                }}
              />
              {showCursor && (
                <span 
                  className="absolute top-0 w-[2px] h-[1.2em] bg-blue-400 animate-pulse"
                  style={{ 
                    left: `${cursorPosition * 0.6}em`,
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <div ref={messagesEndRef} />
        {/* Spaceship Launchpad - moved inside the green box */}
        <div className="relative flex items-center justify-center mt-4" style={{ height: '80px' }}>
          <Spaceship
            isMoving={isShipMoving || !!wordAnimation.length}
            position={shipPosition}
            style={{
              transition: 'transform 0.1s ease-out',
              transform: `translateX(${shipPosition}px)`
            }}
          />
        </div>
      </div>
    </div>
  );
}; 