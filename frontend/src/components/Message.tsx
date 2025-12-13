type MessageProps = {
  type: string;
  message: string;
  icon: React.ReactNode;
};

function Message({ type, message, icon }: MessageProps) {
  return (
    <div className={`${type}`}>
      {icon}
      <p>{message}</p>
    </div>
  );
}

export default Message;
