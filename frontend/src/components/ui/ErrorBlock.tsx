import Button from './Button';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBlock({ message, onRetry }: Props) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-red-600 mb-4">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}