import type { RouteObject } from 'react-router';
import { BookingPage } from '../features/booking/BookingPage';
import { ExpensesPage } from '../features/expenses/ExpensesPage';
import { FileTreePage } from '../features/file-tree/FileTreePage';
import { TypeaheadPage } from '../features/typeahead/TypeaheadPage';
import { UploaderPage } from '../features/uploader/UploaderPage';
import { HomePage } from './HomePage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

// Each feature owns everything below its path, so feature branches never need to edit this file.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'expenses/*', element: <ExpensesPage /> },
      { path: 'typeahead/*', element: <TypeaheadPage /> },
      { path: 'booking/*', element: <BookingPage /> },
      { path: 'file-tree/*', element: <FileTreePage /> },
      { path: 'uploader/*', element: <UploaderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
