import React, { useState, useRef, useEffect } from "react"
import ChatMessage from "./ChatMessage"
import Client from "../services/api"
import peccy from "../assets/peccy.png"
import { CHAT, X } from "../assets/icons"

interface Message {
  text: string
  sender: "bot" | "user"
}

const Chatbot = () => {
  const [msgs, setMsgs] = useState<Message[]>(() => {
    const storedData = sessionStorage.getItem("chatData")

    return storedData
      ? JSON.parse(storedData).messages
      : [{ text: "Hello! How can I help you?", sender: "bot" }]
  })

  const [sessionId, setSessionId] = useState<string | null>(() => {
    const storedData = sessionStorage.getItem("chatData")
    return storedData ? JSON.parse(storedData).sessionId : null
  })
  const [showQuestions, setShowQuestions] = useState(true)
  const [inputText, setInputText] = useState("")
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight
    }
  }, [msgs])

  useEffect(() => {
    // localStorage.setItem("chatHistory", JSON.stringify(msgs))
    sessionStorage.setItem("chatData", JSON.stringify({messages: msgs, sessionId: sessionId}))
  }, [msgs, sessionId])

  const getRes = async (question: string) => {
    try {
      const req = sessionId ? {question, sessionId} : {question}
      const res = await Client.post("/assistant", req)
      return {answer: res.data.answer, sessionId: res.data.sessionId}
    } catch (error) {
      console.error(error)
      return { answer: "Sorry, something went wrong while fetching the response.", sessionId: null }
    }
  }

  const handleQuestion = async (questionText: string) => {
    const userMsg: Message = { text: questionText, sender: "user" }
    setMsgs(prev => [...prev, userMsg])

    setShowQuestions(false)

    const res = await getRes(questionText)
    if(res.sessionId) {
      setSessionId(res.sessionId)

    }

    const botMsg: Message = { text: res.answer, sender: "bot" }
    setMsgs(prev => [...prev, botMsg])
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
  }

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if(e.key === "Enter" && inputText.trim()) {
      handleQuestion(inputText)
      setInputText("")
    }
  }
  const handleSend = () => {
    if (inputText.trim()) {
      handleQuestion(inputText)
      setInputText("")
    }
  }

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
                  onClick={() => handleQuestion("What can I do on this platform?")}
                >
                  What can I do on this platform?
                </button>

                <button
                  className="question"
                  onClick={() => handleQuestion("How do I start exploring the building?")}
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
              onKeyDown={handleEnter}
            />
            <button onClick={handleSend} disabled={!inputText.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Chatbot
