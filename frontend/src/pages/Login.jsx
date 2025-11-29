import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <div className="flex flex-col items-center mb-4">
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: 'var(--primary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        marginBottom: '1rem'
                    }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="font-bold text-lg" style={{ color: 'var(--primary-dark)' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Sign in to AgriQcert</p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: 'var(--error)',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem',
                        fontSize: '0.875rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="label">Email Address</label>
                        <input
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="text-center mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '500' }}>Register</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
