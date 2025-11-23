const ChatMessage = ({text, sender}) => {
    return(
        <div className={sender === 'bot' ? 'bot-msg' : 'user-msg'}>
            {text}
        </div>
    )
}
export default ChatMessage