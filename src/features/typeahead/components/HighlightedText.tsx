import type { JSX } from 'react';
import { splitByMatch } from '../model/highlight';
import './HighlightedText.css';

type HighlightedTextProps = Readonly<{
  text: string;
  query: string;
}>;

export function HighlightedText({ text, query }: HighlightedTextProps): JSX.Element {
  return (
    <>
      {splitByMatch(text, query).map((segment) =>
        segment.isMatch ? (
          <mark key={segment.start} className="highlighted-text__match">
            {segment.text}
          </mark>
        ) : (
          <span key={segment.start}>{segment.text}</span>
        ),
      )}
    </>
  );
}
