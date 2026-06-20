import { Outlet } from 'react-router-dom';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';

export default function Layout() {
  return (
    <div className="app-layout">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
