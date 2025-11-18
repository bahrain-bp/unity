type InfoCardProps = {
  id: number;
  content: string;
  classes: string;
  onClick: (id: number) => void;
  icon: React.ReactNode;
};

function InfoCard({ id, icon, content, classes, onClick }: InfoCardProps) {
  return (
    <div
      onClick={() => onClick(id)}
      className={`infocard${classes ? " " + classes : ""}`}
    >
      <span className="infocard__icon">{icon}</span>
      <p className="infocard__content">{content}</p>
    </div>
  );
}

export default InfoCard;
