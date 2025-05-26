import { useState, useRef, useEffect } from 'react';
import { Spaceship } from './Spaceship';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WordAnimation {
  word: string;
  start: number;
  end: number;
  progress: number;
  x: number;
  state: 'floating' | 'attacking' | 'returning' | 'exploding';
  targetX?: number;
  targetY?: number;
}

interface Missile {
  id: number;
  x: number;
  start: number;
  end: number;
  progress: number;
}

// Box-Muller transform to generate normally distributed random numbers
const normalRandom = (mean: number, stdDev: number): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
};

// Add this new component for rendering messages with attacking words
const MessageContent = ({ content, attackingWords, hitWords }: { content: string, attackingWords: Set<string>, hitWords: Set<string> }) => {
  const words = content.split(/\s+/);
  const elements = words.map((word, i) => {
    if (attackingWords.has(word) || hitWords.has(word)) {
      return <span key={i} style={{ color: 'black' }}>{word}</span>;
    }
    return word;
  });

  // Add spaces between words
  const contentWithSpaces = elements.reduce((acc: React.ReactNode[], element, i) => {
    if (i > 0) {
      acc.push(' ');
    }
    acc.push(element);
    return acc;
  }, []);

  return <>{contentWithSpaces}</>;
};

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [displayedAssistantMessage, setDisplayedAssistantMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wordAnimation, setWordAnimation] = useState<WordAnimation[]>([]);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [shipPosition, setShipPosition] = useState(400);
  const [isShipMoving, setIsShipMoving] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  const [showCursor, setShowCursor] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isShipExploding, setIsShipExploding] = useState(false);
  const [attackInterval, setAttackInterval] = useState<NodeJS.Timeout | null>(null);
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [nextMissileId, setNextMissileId] = useState(0);
  const [explodingWords, setExplodingWords] = useState<Set<string>>(new Set());
  const [attackingWords, setAttackingWords] = useState<Set<string>>(new Set());
  const [hitWords, setHitWords] = useState<Set<string>>(new Set());

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
          x: shipPosition,
          state: 'floating'
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

  // Start attack interval when message is complete
  useEffect(() => {
    if (!isLoading && messages.length > 0 && wordAnimation.length === 0 && pendingWords.length === 0) {
      // Get the last assistant message
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant')?.content;
      
      if (lastAssistantMessage) {
        console.log('Starting attack interval with message:', lastAssistantMessage);
        // Start attack interval
        const interval = setInterval(() => {
          // Pick a random word from the last assistant message, excluding hit words
          const words = lastAssistantMessage.split(/\s+/)
            .filter(word => word.length > 2 && !hitWords.has(word)); // Only attack words longer than 2 chars and not hit
          
          if (words.length > 0) {
            const randomWord = words[Math.floor(Math.random() * words.length)];
            // Create a fixed attack pattern
            const containerWidth = animationContainerRef.current?.clientWidth || 800;
            const attackPositions = [
              containerWidth * 0.25,  // Left
              containerWidth * 0.5,   // Center
              containerWidth * 0.75   // Right
            ];
            const randomX = attackPositions[Math.floor(Math.random() * attackPositions.length)];
            
            console.log('Attacking with word:', randomWord);
            setAttackingWords(prev => new Set([...prev, randomWord]));
            setWordAnimation(prev => [...prev, {
              word: randomWord,
              start: Date.now(),
              end: Date.now() + 2000, // Slower animation (2 seconds)
              progress: 0,
              x: randomX,
              state: 'attacking' as const,
              targetX: randomX // Keep the same X position
            }]);
          }
        }, 1500); // Attack every 1.5 seconds
        
        setAttackInterval(interval);
      }
    }
    
    return () => {
      if (attackInterval) {
        console.log('Clearing attack interval');
        clearInterval(attackInterval);
      }
    };
  }, [isLoading, messages, wordAnimation, pendingWords, hitWords]);

  // Reset ship explosion after animation
  useEffect(() => {
    if (isShipExploding) {
      const timer = setTimeout(() => {
        setIsShipExploding(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isShipExploding]);

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

  // Add click handler for shooting missiles
  const handleContainerClick = (e: React.MouseEvent) => {
    if (isLoading) return;
    
    // Don't shoot if clicking on input or links
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'A' || target.tagName === 'BUTTON') return;

    // Create new missile at ship position, centered on the ship
    const newMissile: Missile = {
      id: nextMissileId,
      x: shipPosition + 39, // Add half of the ship's width (50px) to center the missile
      start: Date.now(),
      end: Date.now() + 1000, // 1 second flight time
      progress: 0
    };

    setMissiles(prev => [...prev, newMissile]);
    setNextMissileId(prev => prev + 1);
  };

  // Animation frame for animating words and missiles
  useEffect(() => {
    if (wordAnimation.length === 0 && missiles.length === 0) return;
    
    let raf: number;
    const animate = () => {
      const now = Date.now();
      
      // Update missiles
      setMissiles(prev => {
        const updated = prev.map(missile => {
          const progress = Math.min((now - missile.start) / (missile.end - missile.start), 1);
          return { ...missile, progress };
        });
        return updated.filter(missile => missile.progress < 1);
      });

      // Update progress for all animations
      setWordAnimation(prev => {
        const updated = prev.map(anim => {
          const duration = anim.end - anim.start;
          const progress = Math.min((now - anim.start) / duration, 1);
          
          // Handle different animation states
          if (anim.state === 'floating') {
            return { ...anim, progress };
          } else if (anim.state === 'attacking') {
            // Calculate position for attacking animation
            const attackProgress = Math.min((now - anim.start) / 2000, 1);
            const currentX = anim.x;
            
            // Check for collision with missiles
            const missileCollision = missiles.some(missile => {
              const missileY = (animationContainerRef.current?.clientHeight || 0) * (1 - missile.progress);
              const wordY = (animationContainerRef.current?.clientHeight || 0) * attackProgress;
              const missileX = missile.x;
              const tolerance = 30; // pixels of tolerance for collision
              
              return Math.abs(missileY - wordY) < tolerance && Math.abs(missileX - currentX) < tolerance;
            });

            if (missileCollision) {
              setExplodingWords(prev => new Set([...prev, anim.word]));
              setAttackingWords(prev => {
                const newSet = new Set(prev);
                newSet.delete(anim.word);
                return newSet;
              });
              setHitWords(prev => new Set([...prev, anim.word]));
              return { 
                ...anim, 
                state: 'exploding' as const, 
                start: now, 
                end: now + 500,
                x: currentX,
                progress: 0, // Reset progress for explosion animation
                targetY: (animationContainerRef.current?.clientHeight || 0) * attackProgress // Store the current Y position
              };
            }
            
            // Check for collision with spaceship when word reaches bottom
            if (attackProgress >= 1 && !isShipExploding) {
              const shipX = shipPosition;
              const tolerance = 30;
              
              if (Math.abs(currentX - shipX) < tolerance) {
                console.log('Collision detected!');
                setIsShipExploding(true);
                setAttackingWords(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(anim.word);
                  return newSet;
                });
                return { ...anim, progress: 1 };
              } else {
                setAttackingWords(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(anim.word);
                  return newSet;
                });
                return { ...anim, state: 'returning' as const, start: now, end: now + 2000 };
              }
            }
            
            return { ...anim, progress: attackProgress, x: currentX };
          } else if (anim.state === 'returning') {
            const returnProgress = Math.min((now - anim.start) / 2000, 1);
            const startX = anim.x;
            const endX = anim.targetX || 0;
            const currentX = startX + (endX - startX) * returnProgress;
            
            return { ...anim, progress: returnProgress, x: currentX };
          } else if (anim.state === 'exploding') {
            const explodeProgress = Math.min((now - anim.start) / 500, 1);
            return { 
              ...anim, 
              progress: explodeProgress,
              x: anim.x // Keep the same x position during explosion
            };
          }
          
          return { ...anim, progress };
        });
        
        return updated.filter(anim => anim.progress < 1);
      });
      
      if (wordAnimation.length > 0 || missiles.length > 0) {
        raf = requestAnimationFrame(animate);
      }
    };
    
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [wordAnimation, missiles, isShipExploding, shipPosition]);

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 font-mono p-4">
      <div 
        className="relative flex flex-col flex-1 mb-2 border-2 border-green-400 rounded-lg p-4" 
        style={{ minHeight: 0 }}
        onClick={handleContainerClick}
      >
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
                {message.role === 'assistant' ? (
                  <MessageContent content={message.content} attackingWords={attackingWords} hitWords={hitWords} />
                ) : (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {/* Animated assistant message in progress */}
          {isLoading && (
            <div className="mb-4 text-green-400">
              <div className="font-bold mb-1">&gt; AI</div>
              <div className="prose prose-invert max-w-none">
                <MessageContent content={displayedAssistantMessage} attackingWords={attackingWords} hitWords={hitWords} />
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
                top: anim.state === 'attacking' 
                  ? `${(animationContainerRef.current.clientHeight + 80) * anim.progress}px`
                  : anim.state === 'exploding'
                  ? `${anim.targetY || 0}px`
                  : `${48 + (animationContainerRef.current.clientHeight - 100) * (1 - anim.progress)}px`,
                transition: 'none',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 20,
                fontSize: anim.state === 'exploding' ? `${1 + anim.progress * 1.5}em` : '1em',
                opacity: anim.state === 'exploding' ? 1 - anim.progress : 1,
                color: anim.state === 'exploding' ? '#ff0000' : 'inherit',
                transform: anim.state === 'exploding' 
                  ? `scale(${1 + anim.progress * 2}) rotate(${anim.progress * 360}deg)`
                  : 'none',
                textShadow: anim.state === 'exploding' 
                  ? `0 0 ${anim.progress * 10}px #ff0000, 0 0 ${anim.progress * 20}px #ff0000`
                  : 'none',
                willChange: 'transform, opacity, font-size, color, text-shadow'
              }}
              className={`${anim.state === 'attacking' ? 'word-attacking' : ''} 
                         ${anim.state === 'returning' ? 'word-returning' : ''}
                         ${anim.state === 'exploding' ? 'word-exploding' : ''}`}
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
            isExploding={isShipExploding}
            style={{
              transition: 'transform 0.1s ease-out',
              transform: `translateX(${shipPosition}px)`
            }}
          />
        </div>
        {/* Add missiles to the animation container */}
        {missiles.map(missile => (
          <div
            key={missile.id}
            className="absolute w-2 h-4 bg-red-500"
            style={{
              left: `${missile.x}px`,
              top: `${(animationContainerRef.current?.clientHeight || 0) * (1 - missile.progress)}px`,
              transform: 'translateX(-50%)',
              transition: 'none',
              pointerEvents: 'none',
              zIndex: 20,
            }}
          />
        ))}
      </div>
    </div>
  );
}; 