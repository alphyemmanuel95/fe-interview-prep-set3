import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './questions';
import { routes } from './routes';

describe('HomePage', () => {
  it('links to every question route', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    const overview = screen.getByRole('list', { name: 'Questions overview' });
    for (const question of QUESTIONS) {
      expect(
        within(overview).getByRole('link', { name: `Q${question.number} — ${question.title}` }),
      ).toHaveAttribute('href', question.path);
    }
  });

  it('renders a not-found page for unknown routes', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
