import { useState, useRef, useEffect } from 'react';
import { Spaceship } from './Spaceship';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hitWords?: Set<string>;
  hitWordIds?: Set<string>;
}

interface WordAnimation {
  word: string;
  start: number;
  end: number;
  progress: number;
  x: number;
  y?: number;
  state: 'floating' | 'attacking' | 'returning' | 'exploding';
  targetX?: number;
  targetY?: number;
  wordId?: string;
  startY?: number;
}

interface Missile {
  id: number;
  x: number;
  start: number;
  end: number;
  progress: number;
}

const SPACESHIP_AREA_HEIGHT = 60; // Height of the spaceship area in pixels

// Add this new component for rendering messages with attacking words
const MessageContent = ({ content, attackingWords, hitWordIds, messageIndex }: { 
  content: string, 
  attackingWords: Set<string>, 
  hitWordIds?: Set<string>,
  messageIndex: number 
}) => {
  // Split content into words and emojis using a more robust regex
  const words = content.match(/[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]|[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[.,!?;:]/gu) || [];
  
  const elements = words.map((word, i) => {
    const wordId = `${messageIndex}-${i}-${word}`;
    const isAttacking = attackingWords.has(wordId);
    const isHit = hitWordIds?.has(wordId) || false;
    const isEmoji = /[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u.test(word);
    const isNumber = /^\d+$/.test(word);
    
    return (
      <span 
        key={wordId}
        data-word-id={wordId}
        className={`word ${isAttacking ? 'attacking' : ''} ${isHit ? 'hit' : ''}`}
        style={{ 
          color: isEmoji ? 'inherit' : (isAttacking ? 'black' : isHit ? 'black' : 'inherit'),
          opacity: (isEmoji || isNumber) && (isAttacking || isHit) ? 0 : 1,
          display: 'inline-block',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          pointerEvents: 'none',
          // Add specific styling for emojis and numbers
          fontSize: isEmoji ? '1.2em' : 'inherit',
          lineHeight: isEmoji ? '1' : 'inherit',
          // Maintain exact width
          width: isEmoji ? '1.2em' : isNumber ? '1em' : 'auto',
          textAlign: 'center'
        }}
      >
        {word}
      </span>
    );
  });

  // Add spaces between words as non-selectable spans
  const contentWithSpaces = elements.reduce((acc: React.ReactNode[], element, i) => {
    if (i > 0) {
      acc.push(
        <span 
          key={`space-${i}`}
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          {' '}
        </span>
      );
    }
    acc.push(element);
    return acc;
  }, []);

  return <>{contentWithSpaces}</>;
};

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('print me 100 purple galaga space emojis with no other text');
  const [displayedAssistantMessage, setDisplayedAssistantMessage] = useState<string>('');
  const [streamingHitWordIds, setStreamingHitWordIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [wordAnimation, setWordAnimation] = useState<WordAnimation[]>([]);
  const [shipPosition, setShipPosition] = useState(400);
  const currentShipPositionRef = useRef(400);
  const [isShipMoving, setIsShipMoving] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [cursorPosition, setCursorPosition] = useState(57);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isShipExploding, setIsShipExploding] = useState(false);
  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [explodingWords, setExplodingWords] = useState<Set<string>>(new Set());
  const [attackingWords, setAttackingWords] = useState<Set<string>>(new Set());
  const [displayedWordPositions, setDisplayedWordPositions] = useState<Map<string, { x: number, y: number, width: number, word: string }>>(new Map());
  const firingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseDownRef = useRef(false);
  const [streamingComplete, setStreamingComplete] = useState(false);
  const [streamingActive, setStreamingActive] = useState(false);

  // Update the ref whenever shipPosition changes
  useEffect(() => {
    currentShipPositionRef.current = shipPosition;
  }, [shipPosition]);

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
        const minX = -24; // Allow going all the way to the left
        const maxX = containerRect.width - 24; // Full width minus ship width (78px)
        const clampedX = Math.max(minX, Math.min(maxX, relativeX));
        setShipPosition(clampedX);
      }
    };

    // Only add mousemove listener if we're not in a loading or exploding state
    if (!isShipExploding) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isShipExploding]);

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
  }, [messages, displayedAssistantMessage, input]);

  // Focus input on initial load and when messages change
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Trigger initial height adjustment
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [messages, displayedAssistantMessage]);

  // Keep input focused at all times
  useEffect(() => {
    // Only enable auto-focus on desktop devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't refocus if clicking on a link or button
      if (target.tagName === 'A' || target.tagName === 'BUTTON') return;
      
      // Don't refocus if clicking on a word
      if (target.classList.contains('word')) return;

      // Refocus the input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    const handleBlur = () => {
      // Small delay to ensure other click handlers have run
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    };

    window.addEventListener('click', handleWindowClick);
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('blur', handleBlur);
    }

    return () => {
      window.removeEventListener('click', handleWindowClick);
      if (inputElement) {
        inputElement.removeEventListener('blur', handleBlur);
      }
    };
  }, []);

  // Handle input changes and cursor position
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setInput(target.value);
    setCursorPosition(target.selectionStart || 0);
    
    // Adjust height
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  };

  // Handle key navigation
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessage = input.trim();
      setInput('');
      setCursorPosition(0); // Reset cursor position when sending message
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setDisplayedAssistantMessage('');
      setShipPosition(400);
      setIsShipMoving(false);
      setMissiles([]); // Clear any existing missiles
      setWordAnimation([]); // Clear any existing word animations
      setAttackingWords(new Set()); // Clear any attacking words

      const requestBody = {
        user_message: userMessage,
        developer_message: "The user is playing a Galaga game where they get to shoot down the words that you send to them.",
        message_history: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };

      try {
        // In the browser, NEXT_PUBLIC_ variables are available
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          
        const response = await fetch(`${apiUrl}/api/chat`, {
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
        setStreamingActive(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Complete API response:', displayedAssistantMessage);
            setStreamingComplete(true);
            setStreamingActive(false);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          setDisplayedAssistantMessage(prev => prev + chunk);
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong!' }]);
      }
    }
  };

  // Extract missile firing logic into a separate function
  const fireMissile = () => {
    const newMissile: Missile = {
      id: Date.now() + Math.random(), // Use timestamp + random number for unique ID
      x: currentShipPositionRef.current + 17,// + 39, // Use the ref for current position
      start: Date.now(),
      end: Date.now() + 1000, // 1 second flight time
      progress: 0
    };

    setMissiles(prev => [...prev, newMissile]);
  };

  const startFiring = () => {
    // Clear any existing interval first
    if (firingIntervalRef.current) {
      clearInterval(firingIntervalRef.current);
      firingIntervalRef.current = null;
    }
    
    isMouseDownRef.current = true;
    fireMissile(); // Fire immediately
    
    // Start new interval
    firingIntervalRef.current = setInterval(() => {
      if (isMouseDownRef.current) {
        fireMissile();
      }
    }, 200);
  };

  const stopFiring = () => {
    isMouseDownRef.current = false;
    if (firingIntervalRef.current) {
      clearInterval(firingIntervalRef.current);
      firingIntervalRef.current = null;
    }
  };

  // When all words are delivered, finalize the message
  useEffect(() => {
    if (streamingComplete) {
      console.log('Finalizing message:', displayedAssistantMessage);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: displayedAssistantMessage,
        hitWordIds: streamingHitWordIds 
      }]);
      setDisplayedAssistantMessage('');
      setStreamingHitWordIds(new Set());
      setIsShipMoving(false);
      setStreamingComplete(false);
      
      // Clear any existing interval
      if (attackIntervalRef.current) {
        clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = null;
      }
    }
  }, [displayedAssistantMessage, streamingComplete]);

  // Start attack interval when message is complete
  useEffect(() => {
    if (messages.length > 0) {
      // Get the last assistant message
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant')?.content;
      
      if (lastAssistantMessage) {
        // Clear any existing interval
        if (attackIntervalRef.current) {
          console.log('Clearing existing attack interval');
          clearInterval(attackIntervalRef.current);
        }
        
        // Start attack interval
        const interval = setInterval(() => {
          // Get the last message to check hit words
          const lastMessage = messages[messages.length - 1];
          const hitWordIds = lastMessage?.hitWordIds || new Set();
          
          // Create an array of all word instances with their IDs
          const wordInstances: { word: string, id: string }[] = [];
          const words = lastMessage.content.match(/[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]|[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[.,!?;:]/gu) || [];
          
          words.forEach((word, index) => {
            if (word.trim() !== '') {
              const wordId = `${messages.length - 1}-${index}-${word}`;
              // Only add words that haven't been hit and aren't currently attacking
              if (!hitWordIds.has(wordId) && !attackingWords.has(wordId)) {
                // Only add the word if we have a valid position for it
                const wordPosition = displayedWordPositions.get(wordId);
                if (wordPosition) {
                  wordInstances.push({ word, id: wordId });
                }
              }
            }
          });
          
          if (wordInstances.length > 0) {
            // Pick a random word instance
            const randomInstance = wordInstances[Math.floor(Math.random() * wordInstances.length)];
            
            // Get the word's current position
            const wordPosition = displayedWordPositions.get(randomInstance.id);
            if (!wordPosition) return; // Skip if we don't have a valid position
            
            const startY = wordPosition.y;
            const startX = wordPosition.x;
            
            console.log('Attacking with word:', randomInstance.word, 'ID:', randomInstance.id);
            setAttackingWords(prev => new Set([...prev, randomInstance.id]));
            setWordAnimation(prev => [...prev, {
              word: randomInstance.word,
              start: Date.now(),
              end: Date.now() + 2000, // Slower animation (2 seconds)
              progress: 0,
              x: startX,
              state: 'attacking' as const,
              targetX: startX, // Keep the same X position
              wordId: randomInstance.id, // Track the specific instance
              startY: startY // Add the starting y position
            }]);
          }
        }, 300); // Attack every 0.3 seconds (faster attacks)
        
        attackIntervalRef.current = interval;
      }
    }
    
    return () => {
      if (attackIntervalRef.current) {
        console.log('Clearing attack interval');
        clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = null;
      }
    };
  }, [messages, displayedWordPositions, attackingWords]);

  // Update attackingWords when animations complete
  useEffect(() => {
    const completedWordIds = new Set<string>();
    wordAnimation.forEach(anim => {
      if (anim.progress >= 1 && anim.wordId) {
        completedWordIds.add(anim.wordId);
      }
    });
    
    if (completedWordIds.size > 0) {
      setAttackingWords(prev => {
        const newSet = new Set(prev);
        completedWordIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  }, [wordAnimation]);

  // Reset ship explosion after animation
  useEffect(() => {
    if (isShipExploding) {
      const timer = setTimeout(() => {
        setIsShipExploding(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isShipExploding]);

  // Add this effect to track word positions
  useEffect(() => {
    if (animationContainerRef.current) {
      const wordElements = animationContainerRef.current.querySelectorAll('.word');
      const newPositions = new Map<string, { x: number, y: number, width: number, word: string }>();
      
      wordElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const containerRect = animationContainerRef.current!.getBoundingClientRect();
        const wordId = element.getAttribute('data-word-id');
        const wordText = element.textContent?.trim() || '';
        
        if (wordId && rect.width > 0 && rect.height > 0) {
          const position = {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
            width: rect.width,
            word: wordText
          };
          newPositions.set(wordId, position);
        }
      });
      
      setDisplayedWordPositions(newPositions);
    }
  }, [messages, displayedAssistantMessage]);

  // Update the animation frame effect to check for collisions with displayed words
  useEffect(() => {
    if (wordAnimation.length === 0 && missiles.length === 0) return;
    
    let raf: number;
    const animate = () => {
      const now = Date.now();
      
      // Update missiles
      setMissiles(prev => {
        const updated = prev.map(missile => {
          const progress = Math.min((now - missile.start) / (missile.end - missile.start), 1);
          
          // Check for collisions with displayed words
          const missileY = (animationContainerRef.current?.clientHeight || 0) * (1 - progress);
          const missileX = missile.x;

          let hasCollision = false;
          
          displayedWordPositions.forEach((pos, wordId) => {
            // Skip if this word has already been hit
            const messageMatch = wordId.match(/^(\d+)-/);
            if (messageMatch) {
              const messageIndex = parseInt(messageMatch[1]);
              const message = messages[messageIndex];
              if (message?.hitWordIds?.has(wordId) || streamingHitWordIds.has(wordId)) {
                return; // Skip this word, it's already been hit
              }
            }
            
            // More accurate hit detection for small words
            const wordLeft = pos.x;
            const wordRight = pos.x + pos.width;
            const wordTop = pos.y - 10; // Half of approximate text height
            const wordBottom = pos.y + 10;
            
            // Check if missile is within word boundaries
            const isWithinWordWidth = missileX >= wordLeft - 10 && missileX <= wordRight + 10;
            const isWithinWordHeight = missileY >= wordTop && missileY <= wordBottom;
            
            if (isWithinWordWidth && isWithinWordHeight && !hasCollision) {
              hasCollision = true;
              
              // Trigger explosion animation for the word
              setExplodingWords(prev => new Set([...prev, wordId]));
              
              // Update hitWords for the current message
              setMessages(prev => {
                const newMessages = [...prev];
                if (messageMatch) {
                  const messageIndex = parseInt(messageMatch[1]);
                  if (newMessages[messageIndex] && newMessages[messageIndex].role === 'assistant') {
                    newMessages[messageIndex].hitWordIds = new Set([...(newMessages[messageIndex].hitWordIds || []), wordId]);
                  }
                }
                return newMessages;
              });

              // If it's a streaming message, add to streamingHitWordIds
              if (messageMatch && parseInt(messageMatch[1]) === messages.length) {
                setStreamingHitWordIds(prev => new Set([...prev, wordId]));
              }
            }
          });

          // If there was a collision, set progress to 1 to remove the missile
          if (hasCollision) {
            return { ...missile, progress: 1 };
          }

          return { ...missile, progress };
        });
        return updated.filter(missile => missile.progress < 1);
      });

      // Update progress for all animations
      setWordAnimation(prev => {
        const updated = prev.map(anim => {
          const duration = anim.end - anim.start;
          const progress = Math.min((now - anim.start) / duration, 1);
          
          if (anim.state === 'attacking') {
            // Calculate position for attacking animation
            const attackProgress = Math.min((now - anim.start) / 2000, 1);
            const currentX = anim.x;
            
            // Calculate y position based on start position and progress
            const startY = anim.startY || 0;
            const endY = (animationContainerRef.current?.clientHeight || 0) + SPACESHIP_AREA_HEIGHT; // Bottom of container + offset
            const currentY = startY + (endY - startY) * attackProgress;
            
            // Check for collision with missiles
            const missileCollision = missiles.some(missile => {
              const missileY = (animationContainerRef.current?.clientHeight || 0) * (1 - missile.progress);
              const missileX = missile.x;
              
              // More accurate hit detection with emoji support
              const isEmoji = /[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u.test(anim.word);
              const wordWidth = isEmoji ? 24 : anim.word.length * 10; // Approximate width for emojis
              const wordLeft = currentX;
              const wordRight = currentX + wordWidth;
              
              const isWithinWordWidth = missileX >= wordLeft - 10 && missileX <= wordRight + 10;
              const isWithinWordHeight = Math.abs(missileY - currentY) < 20;
              
              return isWithinWordWidth && isWithinWordHeight;
            });

            if (missileCollision) {
              setExplodingWords(prev => new Set([...prev, anim.wordId || anim.word]));
              setAttackingWords(prev => {
                const newSet = new Set(prev);
                if (anim.wordId) {
                  newSet.delete(anim.wordId);
                }
                return newSet;
              });
              
              // Update hitWords for the current message if we have a wordId
              if (anim.wordId) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageMatch = anim.wordId?.match(/^(\d+)-/);
                  if (messageMatch) {
                    const messageIndex = parseInt(messageMatch[1]);
                    if (newMessages[messageIndex] && newMessages[messageIndex].role === 'assistant') {
                      newMessages[messageIndex].hitWordIds = new Set([...(newMessages[messageIndex].hitWordIds || []), anim.wordId!]);
                    }
                  }
                  return newMessages;
                });
              }
              
              return { 
                ...anim, 
                state: 'exploding' as const, 
                start: now, 
                end: now + 500,
                x: currentX,
                progress: 0,
                targetY: currentY
              };
            }
            
            // Check for collision with spaceship when word reaches bottom
            if (attackProgress >= 1 && !isShipExploding) {
              const shipX = shipPosition + 17; //39 // Center of ship
              const tolerance = 50; // Ship width
              
              if (Math.abs(currentX - shipX) < tolerance) {
                console.log('Collision detected!');
                setIsShipExploding(true);
                setAttackingWords(prev => {
                  const newSet = new Set(prev);
                  if (anim.wordId) {
                    newSet.delete(anim.wordId);
                  }
                  return newSet;
                });
                return { ...anim, progress: 1 };
              } else {
                return { 
                  ...anim, 
                  state: 'returning' as const, 
                  start: now, 
                  end: now + 3000,
                  progress: 0,
                  targetY: startY,
                  startY: currentY // Store the starting Y position
                };
              }
            }
            
            return { ...anim, progress: attackProgress, x: currentX };
          } else if (anim.state === 'returning') {
            const returnProgress = Math.min((now - anim.start) / 3000, 1);
            
            // Calculate current Y position based on progress
            const startY = anim.startY ?? ((animationContainerRef.current?.clientHeight || 0) + SPACESHIP_AREA_HEIGHT);
            const targetY = anim.targetY ?? 0;
            const currentY = startY + (targetY - startY) * returnProgress;
            
            // Check for collision with missiles
            const missileCollision = missiles.some(missile => {
              const missileY = (animationContainerRef.current?.clientHeight || 0) * (1 - missile.progress);
              const missileX = missile.x;
              
              // More accurate hit detection with emoji support
              const isEmoji = /[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u.test(anim.word);
              const wordWidth = isEmoji ? 24 : anim.word.length * 10; // Approximate width for emojis
              const wordLeft = anim.x;
              const wordRight = anim.x + wordWidth;
              
              const isWithinWordWidth = missileX >= wordLeft - 10 && missileX <= wordRight + 10;
              const isWithinWordHeight = Math.abs(missileY - currentY) < 20;
              
              return isWithinWordWidth && isWithinWordHeight;
            });

            if (missileCollision) {
              setExplodingWords(prev => new Set([...prev, anim.wordId || anim.word]));
              setAttackingWords(prev => {
                const newSet = new Set(prev);
                if (anim.wordId) {
                  newSet.delete(anim.wordId);
                }
                return newSet;
              });
              
              // Update hitWords for the current message if we have a wordId
              if (anim.wordId) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const messageMatch = anim.wordId?.match(/^(\d+)-/);
                  if (messageMatch) {
                    const messageIndex = parseInt(messageMatch[1]);
                    if (newMessages[messageIndex] && newMessages[messageIndex].role === 'assistant') {
                      newMessages[messageIndex].hitWordIds = new Set([...(newMessages[messageIndex].hitWordIds || []), anim.wordId!]);
                    }
                  }
                  return newMessages;
                });
              }
              
              return { 
                ...anim, 
                state: 'exploding' as const, 
                start: now, 
                end: now + 500,
                x: anim.x,
                progress: 0,
                targetY: currentY
              };
            }
            
            // If we've reached the end position, remove from attackingWords and mark as complete
            if (returnProgress >= 1) {
              setAttackingWords(prev => {
                const newSet = new Set(prev);
                if (anim.wordId) {
                  newSet.delete(anim.wordId);
                }
                return newSet;
              });
              return { ...anim, progress: 1 };
            }
            
            return { 
              ...anim, 
              progress: returnProgress,
              y: currentY // Update the Y position
            };
          } else if (anim.state === 'exploding') {
            const explodeProgress = Math.min((now - anim.start) / 500, 1);
            return { 
              ...anim, 
              progress: explodeProgress,
              x: anim.x
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
  }, [wordAnimation, missiles, isShipExploding, shipPosition, displayedWordPositions, messages, animationContainerRef.current?.clientHeight]);

  // Add effect to set initial cursor position and selection
  useEffect(() => {
    if (inputRef.current) {
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
      setCursorPosition(length);
    }
  }, []);

  return (
    <div className="flex flex-col h-[90vh] md:h-screen bg-black text-green-400 font-mono p-4 overflow-hidden">
      <div 
        className="relative flex flex-col flex-1 mb-2 border-2 border-green-400 rounded-lg p-4" 
        style={{ minHeight: 0 }}
        onMouseDown={(e) => {
          if (isShipExploding) return;
          
          // Don't shoot if clicking on links or buttons
          const target = e.target as HTMLElement;
          if (target.tagName === 'A' || target.tagName === 'BUTTON') return;
          
          // Don't shoot if clicking on a word
          if (target.classList.contains('word')) return;

          startFiring();
        }}
        onMouseUp={stopFiring}
        onMouseLeave={stopFiring}
        onTouchStart={(e) => {
          if (isShipExploding) return;
          
          // Don't shoot if touching links or buttons
          const target = e.target as HTMLElement;
          if (target.tagName === 'A' || target.tagName === 'BUTTON') return;
          
          // Don't shoot if touching a word
          if (target.classList.contains('word')) return;

          startFiring();
        }}
        onTouchEnd={stopFiring}
        onTouchCancel={stopFiring}
        onMouseMove={(e) => {
          if (animationContainerRef.current) {
            const containerRect = animationContainerRef.current.getBoundingClientRect();
            const relativeX = e.clientX - containerRect.left;
            const minX = -24; // Allow going all the way to the left
            const maxX = containerRect.width - 24; // Full width minus ship width (78px)
            const clampedX = Math.max(minX, Math.min(maxX, relativeX));
            setShipPosition(clampedX);
          }
        }}
        onTouchMove={(e) => {
          if (animationContainerRef.current) {
            const touch = e.touches[0];
            const containerRect = animationContainerRef.current.getBoundingClientRect();
            const relativeX = touch.clientX - containerRect.left;
            const minX = -24;
            const maxX = containerRect.width - 24;
            const clampedX = Math.max(minX, Math.min(maxX, relativeX));
            setShipPosition(clampedX);
          }
        }}
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
                  <MessageContent content={message.content} attackingWords={attackingWords} hitWordIds={message.hitWordIds} messageIndex={index} />
                ) : (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {/* Animated assistant message in progress */}
          {displayedAssistantMessage && (
            <div className="mb-4 text-green-400">
              <div className="font-bold mb-1">&gt; AI</div>
              <div className="prose prose-invert max-w-none">
                <MessageContent 
                  content={displayedAssistantMessage} 
                  attackingWords={attackingWords} 
                  hitWordIds={streamingHitWordIds} 
                  messageIndex={messages.length} 
                />
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
                  ? `${(anim.startY || 0) + ((animationContainerRef.current.clientHeight + SPACESHIP_AREA_HEIGHT - (anim.startY || 0)) * anim.progress)}px`
                  : anim.state === 'returning'
                  ? `${anim.y}px`
                  : anim.state === 'exploding'
                  ? `${anim.targetY || 0}px`
                  : `${48 + (animationContainerRef.current.clientHeight - 100) * (1 - anim.progress)}px`,
                transition: 'none',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 20,
                fontSize: /[\p{Emoji}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u.test(anim.word) 
                  ? `${1.2 + (anim.state === 'exploding' ? anim.progress * 1.5 : 0)}em` 
                  : `${1 + (anim.state === 'exploding' ? anim.progress * 1.5 : 0)}em`,
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
          {/* Add explosion animations for hit words in chat */}
          {Array.from(explodingWords).map((wordId, index) => {
            const position = displayedWordPositions.get(wordId);
            if (!position) return null;
            return (
              <span
                key={`explosion-${wordId}-${index}`}
                style={{
                  position: 'absolute',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  transform: 'translate(-50%, -50%)',
                  fontWeight: 'bold',
                  pointerEvents: 'none',
                  zIndex: 20,
                  fontSize: '1.5em',
                  color: '#ff0000',
                  textShadow: '0 0 10px #ff0000, 0 0 20px #ff0000',
                  animation: 'explosion 0.5s ease-out forwards'
                }}
                className="word-exploding"
                onAnimationEnd={() => {
                  setExplodingWords(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(wordId);
                    return newSet;
                  });
                }}
              >
                {position.word}
              </span>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
        {/* Spaceship Launchpad - moved inside the green box */}
        <div 
          className="relative flex items-center justify-center mt-2 w-full" 
          style={{ 
            height: `${SPACESHIP_AREA_HEIGHT}px`,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Spaceship
            isMoving={isShipMoving || !!wordAnimation.length}
            position={shipPosition}
            isExploding={isShipExploding}
            style={{
              transition: 'transform 0.1s ease-out',
              transform: `translateX(${shipPosition}px)`,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
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
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          />
        ))}
      </div>
      {/* Terminal input area */}
      <div className="mt-2">
        <div className="font-bold mb-0.5 text-blue-400">&gt; User</div>
        <div 
          className="relative overflow-hidden flex items-center gap-2" 
          ref={inputContainerRef}
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
            className="flex-1 bg-transparent text-blue-400 outline-none border-none p-0 font-mono resize-none whitespace-pre-wrap break-words"
            disabled={streamingActive}
            style={{
              caretColor: 'transparent',
              minHeight: '1.2em',
              height: 'auto',
              overflow: 'hidden',
              wordBreak: 'break-word',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            rows={1}
          />
          <button
            onClick={() => {
              if (!input.trim()) return;
              const event = { key: 'Enter', preventDefault: () => {}, shiftKey: false } as React.KeyboardEvent;
              handleKeyDown(event);
            }}
            disabled={!input.trim() || streamingActive}
            className="px-3 py-0.5 bg-green-400 text-black font-bold rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm h-[1.2em] leading-none flex items-center"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            Send
          </button>
          {showCursor && (
            <span 
              className="absolute top-0 w-[2px] h-[1.2em] bg-blue-400 animate-pulse pointer-events-none"
              style={{ 
                left: `${cursorPosition * 0.6}em`,
                transform: 'translateX(-50%)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}; 