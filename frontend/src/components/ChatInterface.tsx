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
  const [wordAnimation, setWordAnimation] = useState<Array<{word: string, start: number, end: number, progress: number, x: number}>>([]);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [shipPosition, setShipPosition] = useState(0);
  const [isShipMoving, setIsShipMoving] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());

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
  }, [messages, displayedAssistantMessage, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
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
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setDisplayedAssistantMessage('');
    setPendingWords([]);
    setShipPosition(0);
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
        
        // Improved word splitting that captures all words and punctuation
        const words = buffer.match(/\d+\.?\d*|\b\w+(?:['-]\w+)*\b|[.,!?;:]/g) || [];
        
        if (words.length > 0) {
          // Add all words to pending queue, allowing repeats
          setPendingWords(prev => [...prev, ...words]);
          // Remove only the matched words, preserving any markdown syntax
          buffer = buffer.replace(/\d+\.?\d*|\b\w+(?:['-]\w+)*\b|[.,!?;:]/g, '');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong!' }]);
      setIsLoading(false);
    }
  };

  // Process pending words when current animation completes
  useEffect(() => {
    if (pendingWords.length > 0 && !isShipMoving) {
      const nextWord = pendingWords[0];
      console.log('Processing word:', nextWord, 'Completed words:', Array.from(completedWords));
      
      const containerWidth = animationContainerRef.current?.clientWidth || 800;
      
      // Generate new position using normal distribution
      const stdDev = containerWidth * 0.15; // 15% of container width as standard deviation
      let newX = normalRandom(shipPosition, stdDev);
      
      // Clamp the position to container bounds with padding
      const minX = 50;
      const maxX = containerWidth - 150;
      newX = Math.max(minX, Math.min(maxX, newX));
      
      // Start moving the ship
      setIsShipMoving(true);
      setShipPosition(newX);
      
      // Wait for ship to arrive (100ms transition + 17ms buffer)
      setTimeout(() => {
        setIsShipMoving(false);
        // Add word to animation regardless of whether it's been seen before
        console.log('Adding to animation:', nextWord);
        setWordAnimation(prev => [...prev, {
          word: nextWord,
          start: Date.now(),
          end: Date.now() + 250,
          progress: 0,
          x: newX
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
  }, [pendingWords, isShipMoving, shipPosition]);

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
        </div>
        <div ref={messagesEndRef} />
      </div>
      {/* Spaceship Launchpad */}
      <div className="relative flex items-center justify-center" style={{ height: '80px' }}>
        <Spaceship
          isMoving={isShipMoving || !!wordAnimation.length}
          position={shipPosition}
          style={{
            transition: 'transform 0.1s ease-out',
            transform: `translateX(${shipPosition}px)`
          }}
        />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-black text-green-400 border-2 border-green-400 rounded-lg p-2 focus:outline-none focus:border-green-500"
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-green-400 text-black px-4 py-2 rounded-lg hover:bg-green-500 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}; 