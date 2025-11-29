import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, FileText, ShieldCheck } from 'lucide-react';

const Layout = () => {
    const { user, logout } = useAuth();
    const location = useLocation();

    if (!user) return <Outlet />;

    const isActive = (path) => location.pathname === path;

    return (
        <div className="layout">
            <header className="header" style={{
                backgroundColor: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                padding: '1rem 0'
            }}>
                <div className="container flex items-center justify-between">
                    <Link to="/" className="logo flex items-center gap-2" style={{ textDecoration: 'none' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: 'var(--primary)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <ShieldCheck size={20} />
                        </div>
                        <span className="font-bold text-lg" style={{ color: 'var(--primary-dark)' }}>AgriQcert</span>
                    </Link>

                    <nav className="flex items-center gap-4">
                        <Link
                            to="/"
                            className={`btn ${isActive('/') ? 'btn-primary' : 'btn-outline'}`}
                            style={{ border: 'none' }}
                        >
                            <LayoutDashboard size={18} />
                            Dashboard
                        </Link>

                        <div className="flex items-center gap-4" style={{
                            borderLeft: '1px solid var(--border)',
                            paddingLeft: '1rem',
                            marginLeft: '0.5rem'
                        }}>
                            <div className="user-info text-sm">
                                <div className="font-bold">{user.email}</div>
                                <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user.role}</div>
                            </div>
                            <button onClick={logout} className="btn btn-outline" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="container mt-4 mb-4">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
