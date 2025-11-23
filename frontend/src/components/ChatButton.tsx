import { CHAT } from "../assets/icons"
import { useState } from "react"
import Chatbot from "./ChatBot"
const ChatButton = () => {
    const [IsOpen, setIsOpen] = useState(false)

    return(
        <>
        <button className="chat-button" onClick={() => setIsOpen(!IsOpen)}>
            {CHAT()}
        </button>
        {IsOpen && <Chatbot />}
        </>
    )
}
export default ChatButton