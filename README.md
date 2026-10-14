# Frontend Interview Prep — Set 3

Five React + TypeScript features, each shipped as its own branch, pull request and merge.

| #   | Question                | Route        | PR link                                                                |
| --- | ----------------------- | ------------ | ---------------------------------------------------------------------- |
| 1   | Expense Tracker         | `/expenses`  | [#6](https://github.com/alphyemmanuel95/fe-interview-prep-set3/pull/6) |
| 2   | City Typeahead          | `/typeahead` | [#7](https://github.com/alphyemmanuel95/fe-interview-prep-set3/pull/7) |
| 3   | Event Booking Form      | `/booking`   | [#9](https://github.com/alphyemmanuel95/fe-interview-prep-set3/pull/9) |
| 4   | File Explorer Tree      | `/file-tree` | [#8](https://github.com/alphyemmanuel95/fe-interview-prep-set3/pull/8) |
| 5   | Resumable File Uploader | `/uploader`  |                                                                        |

Video:

## Stack

- **Vite** + **React 19** + **TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **React Router** — one route per question
- **Vitest** + **React Testing Library** + jsdom
- **ESLint** (`typescript-eslint` strict type-checked, react-hooks, jsx-a11y) with zero warnings allowed, **Prettier**
- Plain CSS per component (BEM class names) with design tokens in `src/index.css`
- No UI, form, tree or upload libraries — each question's core logic is hand-written

## Getting started

Requires Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start the dev server                |
| `npm run build`        | Type-check and build for production |
| `npm run typecheck`    | Type-check only                     |
| `npm run lint`         | ESLint, fails on any warning        |
| `npm run format:check` | Prettier check                      |
| `npm test`             | Run the test suite once             |
| `npm run test:watch`   | Run tests in watch mode             |

## Project structure

```
src/
  app/        router, layout, home page
  features/   one folder per question (expenses, typeahead, booking, file-tree, uploader)
  shared/     typed localStorage helpers and small utilities
  test/       test setup
```

Tests live next to the code they cover (`*.test.ts(x)`).
