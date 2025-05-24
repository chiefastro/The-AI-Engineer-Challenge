import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Spaceship } from './Spaceship';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shipPosition, setShipPosition] = useState(0);
  const [isShipMoving, setIsShipMoving] = useState(false);
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<string | null>(null);
  const [displayedAssistantMessage, setDisplayedAssistantMessage] = useState<string>('');
  const [wordsQueue, setWordsQueue] = useState<string[]>([]);
  const [animatingWord, setAnimatingWord] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const [wordAnimation, setWordAnimation] = useState<{word: string, start: number, end: number, progress: number} | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [nextWordTargetX, setNextWordTargetX] = useState<number>(0);
  const [readyToFire, setReadyToFire] = useState(false);
  const [pendingWord, setPendingWord] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [shipReady, setShipReady] = useState(false);
  const currentPositionRef = useRef<number>(0);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When a new message is received, reset the word index
  useEffect(() => {
    if (isLoading && wordsQueue.length > 0 && currentWordIndex === 0) {
      setCurrentWordIndex(0);
    }
  }, [isLoading, wordsQueue]);

  // Measure the X position of the word at currentWordIndex
  useLayoutEffect(() => {
    if (measureRef.current && animationContainerRef.current) {
      // Create a temporary container that matches the chat display exactly
      const tempContainer = document.createElement('div');
      tempContainer.style.visibility = 'hidden';
      tempContainer.style.position = 'absolute';
      tempContainer.style.whiteSpace = 'pre-wrap';
      tempContainer.style.fontFamily = 'monospace';
      tempContainer.style.fontSize = '1em';
      tempContainer.style.width = animationContainerRef.current.clientWidth + 'px';
      tempContainer.style.padding = '1rem';
      tempContainer.style.border = '2px solid green';
      tempContainer.style.borderRadius = '0.5rem';
      
      // Get the exact text that's being displayed
      const displayedText = wordsQueue.slice(0, currentWordIndex + 1).join(' ');
      tempContainer.textContent = displayedText;
      
      // Add to DOM temporarily to measure
      document.body.appendChild(tempContainer);
      
      // Get the position of the last word
      const range = document.createRange();
      const textNode = tempContainer.firstChild;
      if (!textNode) {
        document.body.removeChild(tempContainer);
        return;
      }
      
      range.setStart(textNode, 0);
      range.setEnd(textNode, textNode.textContent?.length || 0);
      
      const rects = Array.from(range.getClientRects());
      if (rects.length === 0) {
        document.body.removeChild(tempContainer);
        return;
      }
      
      // Get the last rectangle (for the last word)
      const lastRect = rects[rects.length - 1];
      
      // Calculate the position relative to the chat container
      const containerRect = animationContainerRef.current.getBoundingClientRect();
      const relativeX = lastRect.right - containerRect.left;
      
      // Check if we're on a new line by comparing top positions
      const isNewLine = rects.length > 1 && 
        Math.abs(rects[rects.length - 1].top - rects[rects.length - 2].top) > 1;
      
      // Add a fixed offset for each word to compensate for accumulated error
      const fixedOffset = 8; // pixels per word
      const adjustedX = isNewLine ? 
        relativeX : // Reset to base position on new line
        relativeX + (currentWordIndex * fixedOffset);
      
      document.body.removeChild(tempContainer);

      console.log('=== Detailed Position Measurement ===');
      console.log('Displayed text:', displayedText);
      console.log('Container width:', animationContainerRef.current.clientWidth);
      console.log('Number of rectangles:', rects.length);
      console.log('Last word position:', relativeX);
      console.log('Is new line:', isNewLine);
      console.log('Fixed offset:', fixedOffset);
      console.log('Adjusted position:', adjustedX);
      console.log('Current word index:', currentWordIndex);
      console.log('Current ship position:', currentPositionRef.current);
      console.log('========================');
      
      // Only update the target position if we're not currently animating
      if (!animatingWord) {
        setNextWordTargetX(adjustedX);
      }
    }
  }, [displayedAssistantMessage, currentWordIndex, isLoading, wordsQueue, animatingWord]);

  // When nextWordTargetX changes, update ship position
  useEffect(() => {
    if (
      isLoading &&
      wordsQueue.length > 0 &&
      currentWordIndex < wordsQueue.length &&
      !animatingWord
    ) {
      // Use the measured width directly as the new position
      const newPosition = nextWordTargetX;
      console.log('=== Ship Position Update ===');
      console.log('Setting ship position to:', newPosition);
      console.log('For current word:', wordsQueue[currentWordIndex]);
      console.log('Current word index:', currentWordIndex);
      console.log('Current ship position:', currentPositionRef.current);
      console.log('========================');
      
      // Update position immediately
      currentPositionRef.current = newPosition;
      setShipPosition(newPosition);
    }
  }, [nextWordTargetX, isLoading, wordsQueue, currentWordIndex, animatingWord]);

  // Start word animation after ship position is set
  useEffect(() => {
    if (
      isLoading &&
      wordsQueue.length > 0 &&
      currentWordIndex < wordsQueue.length &&
      !animatingWord &&
      Math.abs(currentPositionRef.current - nextWordTargetX) < 1
    ) {
      console.log('=== Starting Animation ===');
      console.log('Word:', wordsQueue[currentWordIndex]);
      console.log('Position:', currentPositionRef.current);
      console.log('Target position:', nextWordTargetX);
      console.log('Current index:', currentWordIndex);
      console.log('========================');
      
      // Set animating word first to prevent position updates during animation
      setAnimatingWord(wordsQueue[currentWordIndex]);
      
      // Then start the animation
      setWordAnimation({ 
        word: wordsQueue[currentWordIndex], 
        start: Date.now(), 
        end: Date.now() + 750,
        progress: 0 
      });
    }
  }, [shipPosition, nextWordTargetX, isLoading, wordsQueue, currentWordIndex, animatingWord]);

  // Animation frame for animating word
  useEffect(() => {
    if (!wordAnimation) return;
    let raf: number;
    const animate = () => {
      const now = Date.now();
      const duration = wordAnimation.end - wordAnimation.start;
      const progress = Math.min((now - wordAnimation.start) / duration, 1);
      
      // Log progress every 100ms
      if (Math.floor(progress * 10) !== Math.floor((progress - 0.01) * 10)) {
        console.log(`Animation progress: ${Math.floor(progress * 100)}% for word: ${wordAnimation.word} at position: ${currentPositionRef.current}`);
      }
      
      setWordAnimation((prev) => prev ? { ...prev, progress } : null);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        console.log('=== Animation Complete ===');
        console.log('Word:', wordAnimation.word);
        console.log('Final position:', currentPositionRef.current);
        console.log('========================');
        setDisplayedAssistantMessage((prev) => prev + (prev ? ' ' : '') + wordAnimation.word);
        setAnimatingWord(null);
        setWordAnimation(null);
        setCurrentWordIndex((prev) => prev + 1);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [wordAnimation]);

  // When all words are delivered, finalize the message and stop the ship
  useEffect(() => {
    if (
      isLoading &&
      displayedAssistantMessage &&
      (currentWordIndex >= wordsQueue.length) &&
      !animatingWord
    ) {
      setMessages(prev => [...prev, { role: 'assistant', content: displayedAssistantMessage }]);
      setIsLoading(false);
      setIsShipMoving(false);
      setDisplayedAssistantMessage('');
      setPendingAssistantMessage(null);
      setCurrentWordIndex(0);
    }
  }, [isLoading, displayedAssistantMessage, wordsQueue, animatingWord, currentWordIndex]);

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
    setIsShipMoving(true);
    setDisplayedAssistantMessage('');
    setPendingAssistantMessage(null);
    setWordsQueue([]);
    setAnimatingWord(null);

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
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(`Network response was not ok: ${response.status}`);
      }

      // Read the full response as text
      const data = await response.text();
      setPendingAssistantMessage(data);
      setWordsQueue(data.match(/\b\w+\b/g) || []); // Split into words
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong!' }]);
      setIsLoading(false);
      setIsShipMoving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-green-400 font-mono p-4">
      <div className="flex-1 overflow-y-auto mb-4 border-2 border-green-400 rounded-lg p-4 relative" ref={animationContainerRef}>
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
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        {/* Animated assistant message in progress */}
        {isLoading && (
          <div className="mb-4 text-green-400" style={{ position: 'relative' }}>
            <div className="font-bold mb-1">&gt; AI</div>
            <div className="whitespace-pre-wrap" style={{ display: 'inline' }}>
              <span>{wordsQueue.slice(0, currentWordIndex).join(' ')}{currentWordIndex > 0 ? ' ' : ''}</span>
              {/* Hidden span to measure the next word's landing position */}
              <span 
                ref={measureRef} 
                style={{ 
                  visibility: 'hidden', 
                  position: 'absolute', 
                  left: 0, 
                  top: 0,
                  border: '1px solid red' // Debug border
                }}
              >
                {wordsQueue[currentWordIndex] || ''}
              </span>
            </div>
          </div>
        )}
        {/* Floating animating word */}
        {wordAnimation && animationContainerRef.current && (
          <span
            style={{
              position: 'absolute',
              left: `${shipPosition}px`,
              bottom: `${48 + (animationContainerRef.current.clientHeight - 100) * wordAnimation.progress}px`,
              transition: 'none',
              color: '#fff',
              fontWeight: 'bold',
              pointerEvents: 'none',
              zIndex: 20,
              fontSize: '1.2em',
              textShadow: '0 0 4px #00f0ff',
              border: '1px solid yellow' // Debug border
            }}
          >
            {wordAnimation.word}
          </span>
        )}
        <div ref={messagesEndRef} />
        <Spaceship 
          isMoving={isShipMoving || !!wordAnimation} 
          position={shipPosition} 
          style={{
            transition: 'transform 0.3s ease-out',
            transform: `translateX(${shipPosition}px)`,
            border: '1px solid blue' // Debug border
          }}
        />
      </div>
      {/* Debug info */}
      <div className="text-xs text-gray-500 mb-2">
        Ship Position: {shipPosition}px | Next Target: {nextWordTargetX}px | Current Word: {currentWordIndex}
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