import ErrorMessage from '../../components/ErrorMessage';

interface RetryErrorProps {
  message: string;
  onRetry: () => void;
}

// ErrorMessage from the shared components has no retry button, so we add one here.
export default function RetryError({ message, onRetry }: RetryErrorProps) {
  return (
    <div className="item-retry">
      <ErrorMessage message={message} />
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}