type InfoCardProps = {
  name: string;
  content: string;
  classes: string;
  distance: string;
  onClick: (id: string) => void;
  icon: React.ReactNode;
};

function InfoCard({ name, icon, content, distance, classes, onClick }: InfoCardProps) {
  return (
    <div
      onClick={() => onClick(name)}
      className={`infocard${classes ? " " + classes : ""}`}
    >
      <span className="infocard__icon">{icon}</span>
      <p className="infocard__content">{content}</p>
      <span className="infocard__distance">{distance}</span>
    </div>
  );
}

export default InfoCard;