import EmptyState from '@/components/shared/EmptyState';

interface AlgorithmNotFoundProps {
  algorithmId: string;
}

export default function AlgorithmNotFound({ algorithmId }: AlgorithmNotFoundProps) {
  return (
    <EmptyState
      title="Algorithm not found"
      description={`The registry does not have an entry for “${algorithmId}”.`}
      className="text-[var(--text-2)]"
    />
  );
}
