import type { JSX } from 'react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { QUESTIONS } from './questions';
import './Layout.css';

export function Layout(): JSX.Element {
  return (
    <div className="layout">
      <header className="layout__header">
        <NavLink to="/" className="layout__brand">
          FE Interview Prep · Set 3
        </NavLink>
        <nav aria-label="Questions">
          <ul className="layout__nav">
            {QUESTIONS.map((question) => (
              <li key={question.path}>
                <NavLink
                  to={question.path}
                  className={({ isActive }) =>
                    isActive ? 'layout__link layout__link--active' : 'layout__link'
                  }
                >
                  Q{question.number} {question.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
