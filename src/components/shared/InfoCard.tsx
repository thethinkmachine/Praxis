import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import SurfaceCard from '@/components/shared/SurfaceCard';

interface InfoCardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}

export default function InfoCard({ title, children, className, titleClassName }: InfoCardProps) {
  return (
    <SurfaceCard tone="strong" className={cn('space-y-2 rounded-2xl', className)}>
      {title ? <p className={cn('text-[10px] uppercase tracking-[0.18em] text-[var(--text-3)]', titleClassName)}>{title}</p> : null}
      {children}
    </SurfaceCard>
  );
}