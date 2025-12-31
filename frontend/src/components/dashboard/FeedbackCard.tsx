interface Props {
  feedback: any;
}

export function FeedbackCard({ feedback }: Props) {
  const getSentimentClass = () => {
    if (feedback.overallRating >= 4) return "positive";
    if (feedback.overallRating === 3) return "neutral";
    return "negative";
  };

  return (
    <div className={`feedback-card ${getSentimentClass()}`}>
      <div className="visitor-header">
        <div className="name-email">
          <span className="name">{feedback.name}</span>
          <span className="email">{feedback.email}</span>
        </div>
        <span className="created-at">
          {new Date(feedback.createdAt).toLocaleDateString()}
        </span>
      </div>

      <Field label="Purpose of Visit" value={feedback.purpose} />
      <Field label="Check-in Duration" value={formatCheckIn(feedback.checkInTime)} />
      <Field label="Preferred Registration Method" value={formatRegistration(feedback.digitalPref)} />
      <Field label="Was your Visit Experience Faster and Smoother using BAHTWIN?" value={feedback.faster} />
      <Field label="Face Recognition Usefulness" value={renderStars(feedback.faceHelp)} />
      <Field label="Overall Satisfaction" value={renderStars(feedback.overallRating)} />

      {feedback.commentText && (
        <div className="comments">“{feedback.commentText}”</div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="field">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  );
}


// STAR RENDERING WITH COLORS

function renderStars(count: number = 0) {
  let sentimentClass = "neutral";
  if (count >= 4) sentimentClass = "positive";
  else if (count <= 2) sentimentClass = "negative";

  return (
    <span className={`rating ${sentimentClass}`}>
      {"★".repeat(count)}
      {"☆".repeat(5 - count)}
    </span>
  );
}


// FORMATTING HELPERS

function formatCheckIn(value: string) {
  const map: any = {
    less1: "Less than 1 minute",
    "1to2": "1–2 minutes",
    "3to5": "3–5 minutes",
    "more5": "more than 5 minutes "
  };
  return map[value] || value;
}

function formatRegistration(value: string) {
  return value === "face-recognition" ? "Face Recognition" : "Manual Reception";
}
