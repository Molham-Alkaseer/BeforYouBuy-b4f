interface LoadingMessageProps { message: string }

export default function LoadingMessage({ message }: LoadingMessageProps) {
  return (
    <div className="byb-message byb-message-loading" role="status">
      <span className="byb-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
