import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

interface Word {
  id: string;
  text: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isActive: boolean;
  messageId: string;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  position?: { x: number; y: number };
}

interface GameState {
  words: Word[];
  messages: Message[];
  score: number;
  isGameOver: boolean;
}

interface PositionProps {
  x: number;
  y: number;
}

interface MessageBubbleProps {
  $isUser: boolean;
}

const GameContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
`;

const MessageBubble = styled.div<MessageBubbleProps>`
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 15px;
  background-color: ${props => props.$isUser ? '#4a90e2' : '#2c3e50'};
  color: white;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  font-family: 'Courier New', monospace;
`;

const InputArea = styled.div`
  padding: 20px;
  background-color: #1a1a1a;
  display: flex;
  gap: 10px;
`;

const Input = styled.input`
  flex: 1;
  padding: 10px;
  border: 2px solid #4a90e2;
  border-radius: 5px;
  background-color: #2c3e50;
  color: white;
  font-family: 'Courier New', monospace;
  &:focus {
    outline: none;
    border-color: #357abd;
  }
`;

const SendButton = styled.button`
  padding: 10px 20px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  &:hover {
    background: #357abd;
  }
`;

const Spaceship = styled.div<PositionProps>`
  position: absolute;
  width: 40px;
  height: 40px;
  background: linear-gradient(180deg, #4a90e2 0%, #357abd 100%);
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  transform: translate(-50%, -50%) rotate(180deg);
  left: ${(props: PositionProps) => props.x}px;
  top: ${(props: PositionProps) => props.y}px;
  transition: left 0.3s ease-out;
  box-shadow: 0 0 10px #4a90e2;
  pointer-events: none;
  z-index: 10;
`;

const WordBullet = styled.div<PositionProps>`
  position: absolute;
  color: #fff;
  font-size: 16px;
  transform: translate(-50%, -50%);
  left: ${(props: PositionProps) => props.x}px;
  top: ${(props: PositionProps) => props.y}px;
  text-shadow: 0 0 5px #4a90e2;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  pointer-events: none;
  z-index: 5;
`;

const TargetIndicator = styled.div<PositionProps>`
  position: absolute;
  width: 4px;
  height: 4px;
  background-color: #4a90e2;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  left: ${(props: PositionProps) => props.x}px;
  top: ${(props: PositionProps) => props.y}px;
  box-shadow: 0 0 10px #4a90e2;
`;

const ScoreDisplay = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  color: #fff;
  font-size: 24px;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 5px #4a90e2;
`;

const TestButton = styled.button`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  &:hover {
    background: #357abd;
  }
`;

const ChatInterfaceGalaga: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    words: [],
    messages: [],
    score: 0,
    isGameOver: false,
  });
  
  const [spaceshipPos, setSpaceshipPos] = useState<PositionProps>({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState('');
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const wordQueueRef = useRef<string[]>([]);
  const currentMessageRef = useRef<Message | null>(null);

  // Initialize game
  useEffect(() => {
    if (gameContainerRef.current) {
      const { width, height } = gameContainerRef.current.getBoundingClientRect();
      setSpaceshipPos({ x: width / 2, y: height - 100 });
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [gameState.messages]);

  // Game loop
  const gameLoop = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Update game state
    setGameState(prevState => {
      const updatedWords = prevState.words.map(word => {
        if (!word.isActive) return word;

        // Calculate new position
        const dx = word.targetX - word.x;
        const dy = word.targetY - word.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
          // Word reached target, update message position
          const message = prevState.messages.find(m => m.id === word.messageId);
          if (message) {
            const updatedMessages = prevState.messages.map(m => 
              m.id === message.id ? { ...m, position: undefined } : m
            );
            return { ...word, isActive: false, messages: updatedMessages };
          }
          return { ...word, isActive: false };
        }

        const speed = 300; // pixels per second
        const moveX = (dx / distance) * speed * (deltaTime / 1000);
        const moveY = (dy / distance) * speed * (deltaTime / 1000);

        return {
          ...word,
          x: word.x + moveX,
          y: word.y + moveY,
        };
      });

      return {
        ...prevState,
        words: updatedWords,
      };
    });

    // Process word queue
    if (wordQueueRef.current.length > 0 && gameState.words.every(w => !w.isActive)) {
      const nextWord = wordQueueRef.current.shift();
      if (nextWord && currentMessageRef.current) {
        fireWord(nextWord, currentMessageRef.current);
      }
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };

  // Start game loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Fire word
  const fireWord = (word: string, message: Message) => {
    if (!gameContainerRef.current || !message.position) return;

    setGameState(prevState => ({
      ...prevState,
      words: [
        ...prevState.words,
        {
          id: Math.random().toString(36).substr(2, 9),
          text: word,
          x: spaceshipPos.x,
          y: spaceshipPos.y,
          targetX: message.position!.x,
          targetY: message.position!.y,
          isActive: true,
          messageId: message.id,
        },
      ],
    }));
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text: inputValue,
      isUser: true,
    };

    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    setInputValue('');

    try {
      // Call the API
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: inputValue,
          developer_message: "You are a helpful AI assistant.",
          api_key: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let aiResponse = '';
      const aiMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        text: '',
        isUser: false,
        position: { x: 0, y: 0 }, // Will be updated after render
      };

      // Add the message immediately to show it's loading
      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the Uint8Array to text
        const text = new TextDecoder().decode(value);
        aiResponse += text;

        // Update the message text in real-time
        setGameState(prev => ({
          ...prev,
          messages: prev.messages.map(m => 
            m.id === aiMessage.id ? { ...m, text: aiResponse } : m
          ),
        }));
      }

      // Wait for the message to be rendered to get its position
      setTimeout(() => {
        const messageElement = document.getElementById(aiMessage.id);
        if (messageElement) {
          const rect = messageElement.getBoundingClientRect();
          const chatRect = chatAreaRef.current?.getBoundingClientRect();
          if (chatRect) {
            const position = {
              x: rect.left - chatRect.left + rect.width / 2,
              y: rect.top - chatRect.top + rect.height / 2,
            };
            
            setGameState(prev => ({
              ...prev,
              messages: prev.messages.map(m => 
                m.id === aiMessage.id ? { ...m, position } : m
              ),
            }));

            // Queue words for shooting
            currentMessageRef.current = { ...aiMessage, position };
            wordQueueRef.current = aiResponse.split(' ');
          }
        }
      }, 0);
    } catch (error) {
      console.error('Error:', error);
      // Handle error appropriately
    }
  };

  return (
    <GameContainer ref={gameContainerRef}>
      <Spaceship x={spaceshipPos.x} y={spaceshipPos.y} />
      {gameState.words.map(word => (
        <WordBullet key={word.id} x={word.x} y={word.y}>
          {word.text}
        </WordBullet>
      ))}
      <ChatArea ref={chatAreaRef}>
        {gameState.messages.map(message => (
          <MessageBubble 
            key={message.id} 
            id={message.id}
            $isUser={message.isUser}
          >
            {message.text}
          </MessageBubble>
        ))}
      </ChatArea>
      <InputArea>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
        />
        <SendButton onClick={handleSendMessage}>Send</SendButton>
      </InputArea>
    </GameContainer>
  );
};

export default ChatInterfaceGalaga;
