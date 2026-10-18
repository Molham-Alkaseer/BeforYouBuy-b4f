interface EmptyStateProps { message: string }

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="byb-empty-state" role="status">
      <p>{message}</p>
    </div>
  );
}
