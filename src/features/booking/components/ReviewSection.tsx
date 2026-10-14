import type { JSX, ReactNode } from 'react';
import './ReviewSection.css';

type ReviewSectionProps = Readonly<{
  id: string;
  title: string;
  /** Completes the visible "Edit" so each button has a unique accessible name. */
  editLabel: string;
  isEditDisabled: boolean;
  onEdit: () => void;
  children: ReactNode;
}>;

export function ReviewSection({
  id,
  title,
  editLabel,
  isEditDisabled,
  onEdit,
  children,
}: ReviewSectionProps): JSX.Element {
  const titleId = `${id}-title`;
  return (
    <section className="review-section" aria-labelledby={titleId}>
      <div className="review-section__header">
        <h3 id={titleId} className="review-section__title">
          {title}
        </h3>
        <button
          type="button"
          className="review-section__edit"
          disabled={isEditDisabled}
          onClick={onEdit}
        >
          Edit <span className="visually-hidden">{editLabel}</span>
        </button>
      </div>
      {children}
    </section>
  );
}
