interface theProps {
    text: string,
    sender: "bot" | "user"
}
const ChatMessage = ({text, sender}: theProps) => {
    return(
        <div className={sender === 'bot' ? 'bot-msg' : 'user-msg'}>
            {text}
        </div>
    )
}
export default ChatMessage