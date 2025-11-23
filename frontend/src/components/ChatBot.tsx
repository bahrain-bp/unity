import { useState } from "react"
import ChatMessage from "./ChatMessage"
const Chatbot = () => {
    const [msgs, setMsgs] = useState([
        {text: "Hello! How can I help you?", sender: "bot"}
    ])
    const [showQuestions, setShowQuestions] = useState(true)
    const [inputText, setInputText] = useState("")

    const handleQuestion = async (questionText) => {
        const userMsg = {text: questionText, sender: "user"}
        setMsgs(prev => [...prev, userMsg])

        setShowQuestions(false)

        const botRes = await getRes(questionText)
        const botMsg = {text: botRes, sender: "bot"}
        setMsgs(prev => [...prev, botMsg])
    }

    const handleChange = (e) => {
        setInputText(e.target.value)
    }

    const handleSend = () => {
        if(inputText.trim()) {
            handleQuestion(inputText)
            setInputText("")
        }
    }
    const getRes = async(question) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return "This is a fake response to: " + question
    }
    return(
        <>
        <div className="chat-box">
            <div className="chat-header">
                <div className="avatar-circle"></div>
                <div className="header-text">
                    <div className="chat-with">Chat with</div>
                    <div className="peccy">Peccy</div>
                </div>
            </div>
            <div className="chat-body">
                {msgs.map((msg, index) => (
                    <ChatMessage key={index} text={msg.text} sender = {msg.sender} />
                ))}

                {showQuestions && (
                    <div className="quick-questions">
                        <button className="question" onClick={() => handleQuestion("What can I do on this platform?")}>What can I do on this platform?</button>
                        <button className="question" onClick={() => handleQuestion("How do I start exploring the building?")}>How do I start exploring the building?</button>
                        <button className="question" onClick={() => handleQuestion("What is BAHTWIN?")}>What is BAHTWIN?</button>
                    </div>
                )}
                
            </div>
            <div className="chat-input">
                <input type="text" placeholder="Type a question..." value={inputText} onChange={handleChange}/>
                <button onClick={handleSend} disabled={!inputText.trim()}>Send</button>
            </div>
        </div>
        </>
    )
}

export default Chatbot