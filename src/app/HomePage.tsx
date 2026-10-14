import type { JSX } from 'react';
import { Link } from 'react-router';
import { QUESTIONS } from './questions';
import './HomePage.css';

export function HomePage(): JSX.Element {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Frontend Interview Prep — Set 3</h1>
      <p>Five React + TypeScript features, each shipped as its own pull request.</p>
      <ol className="home__grid" aria-label="Questions overview">
        {QUESTIONS.map((question) => (
          <li key={question.path} className="home__card">
            <h2 className="home__card-title">
              <Link to={question.path}>
                Q{question.number} — {question.title}
              </Link>
            </h2>
            <p className="home__summary">{question.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
