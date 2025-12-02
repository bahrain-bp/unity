type InfoCardProps = {
  name: string;
  content: string;
  classes: string;
  onClick: (id: string) => void;
  icon: React.ReactNode;
};

function InfoCard({ name, icon, content, classes, onClick }: InfoCardProps) {
  return (
    <div
      onClick={() => onClick(name)}
      className={`infocard${classes ? " " + classes : ""}`}
    >
      <span className="infocard__icon">{icon}</span>
      <p className="infocard__content">{content}</p>
    </div>
  );
}

export default InfoCard;