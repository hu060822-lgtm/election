import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoadingPanel } from './components/ui';
import Home from './pages/Home';

const Analytics = lazy(() => import('./pages/Analytics'));
const Me = lazy(() => import('./pages/Me'));
const Results = lazy(() => import('./pages/Results'));
const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));

function NotFound() {
  return <div className="py-20 text-center"><p className="num text-6xl font-bold text-text-3">404</p><p className="mt-2 text-text-2">找不到這個頁面。</p></div>;
}

export default function App() {
  const location = useLocation();
  return (
    <Layout>
      <Suspense fallback={<LoadingPanel rows={6} />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/me" element={<Me />} />
          <Route path="/results" element={<Results />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
