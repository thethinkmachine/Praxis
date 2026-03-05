interface AlgorithmNotFoundProps {
  algorithmId: string;
}

export default function AlgorithmNotFound({ algorithmId }: AlgorithmNotFoundProps) {
  return (
    <div className="h-full flex items-center justify-center text-[var(--text-2)]">
      Algorithm &ldquo;{algorithmId}&rdquo; not found.
    </div>
  );
}
