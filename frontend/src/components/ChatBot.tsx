import { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import { Client } from "../services/api";
import peccy from "../assets/peccy.png";
import { CHAT, X } from "../assets/icons";

interface Message {
  text: string;
  sender: "bot" | "user";
}

const Chatbot = () => {
  const [msgs, setMsgs] = useState<Message[]>(() => {
    const storedChat = localStorage.getItem("chatHistory");

    return storedChat
      ? JSON.parse(storedChat)
      : [{ text: "Hello! How can I help you?", sender: "bot" }];
  });

  const [showQuestions, setShowQuestions] = useState(true);
  const [inputText, setInputText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
    }
  }, [msgs]);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(msgs));
  }, [msgs]);

  const getRes = async (question: string) => {
    try {
      const res = await Client.post("/assistant", { question });
      return res.data.answer;
    } catch (error) {
      console.error(error);
      return "Sorry, something went wrong while fetching the response.";
    }
  };

  const handleQuestion = async (questionText: string) => {
    const userMsg: Message = { text: questionText, sender: "user" };
    setMsgs((prev) => [...prev, userMsg]);

    setShowQuestions(false);

    const botRes = await getRes(questionText);
    const botMsg: Message = { text: botRes, sender: "bot" };
    setMsgs((prev) => [...prev, botMsg]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handleQuestion(inputText);
      setInputText("");
    }
  };

  return (
    <>
      <button className="chat-button" onClick={() => setIsOpen(!isOpen)}>
        {CHAT()}
      </button>

      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <div className="avatar-circle">
              <img src={peccy} />
            </div>
            <div className="header-text">
              <div className="chat-with">Chat with</div>
              <div className="peccy">Peccy</div>
            </div>
            <span onClick={() => setIsOpen(false)}>{X()}</span>
          </div>

          <div className="chat-body" ref={chatBottomRef}>
            {msgs.map((msg, index) => (
              <ChatMessage key={index} text={msg.text} sender={msg.sender} />
            ))}

            {showQuestions && msgs.length === 1 && (
              <div className="quick-questions">
                <button
                  className="question"
                  onClick={() =>
                    handleQuestion("What can I do on this platform?")
                  }
                >
                  What can I do on this platform?
                </button>

                <button
                  className="question"
                  onClick={() =>
                    handleQuestion("How do I start exploring the building?")
                  }
                >
                  How do I start exploring the building?
                </button>

                <button
                  className="question"
                  onClick={() => handleQuestion("What is BAHTWIN?")}
                >
                  What is BAHTWIN?
                </button>
              </div>
            )}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Type a question..."
              value={inputText}
              onChange={handleChange}
            />
            <button onClick={handleSend} disabled={!inputText.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
