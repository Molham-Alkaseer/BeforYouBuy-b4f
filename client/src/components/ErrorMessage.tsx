interface ErrorMessageProps { message: string }

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="byb-message byb-message-error" role="alert">
      <span className="byb-message-icon" aria-hidden="true">!</span>
      <p>{message}</p>
    </div>
  );
}
