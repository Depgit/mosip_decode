import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'exporter',
        organization: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register(formData);

        if (result.success) {
            navigate('/login');
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 0' }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
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
                    <h1 className="font-bold text-lg" style={{ color: 'var(--primary-dark)' }}>Create Account</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Join AgriQcert today</p>
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
                        <label className="label">Full Name</label>
                        <input
                            type="text"
                            name="fullName"
                            className="input"
                            value={formData.fullName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            className="input"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="input"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Role</label>
                        <select
                            name="role"
                            className="input"
                            value={formData.role} Role
                            onChange={handleChange}
                        >
                            <option value="exporter">Exporter</option>
                            <option value="qa_agency">QA Agency</option>
                            <option value="inspector">Importer</option>
                            <option value="user">User</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">Organization Name</label>
                        <input
                            type="text"
                            name="organization"
                            className="input"
                            value={formData.organization}
                            onChange={handleChange}
                            placeholder={formData.role === 'qa_agency' ? 'Agency Name' : 'Company Name'}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={loading}
                        style={{ marginTop: '0.5rem' }}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="text-center mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '500' }}>Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
