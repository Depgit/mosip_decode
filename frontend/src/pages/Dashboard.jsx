import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Plus, Package, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import CreateBatchModal from '../components/CreateBatchModal';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const fetchBatches = async () => {
        try {
            const response = await api.get('/batches');
            setBatches(response.data.data);
        } catch (error) {
            console.error('Error fetching batches:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'var(--success)';
            case 'rejected': return 'var(--error)';
            case 'pending': return 'var(--secondary)';
            default: return 'var(--text-secondary)';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={16} />;
            case 'rejected': return <XCircle size={16} />;
            default: return <Clock size={16} />;
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="font-bold text-lg">Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {user.role === 'user' ? 'Manage your product batches' : 'Assigned batches for inspection'}
                    </p>
                </div>

                {user.role === 'user' && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus size={18} />
                        New Batch
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-8">Loading batches...</div>
            ) : batches.length === 0 ? (
                <div className="card text-center py-8">
                    <Package size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
                    <h3 className="font-bold">No batches found</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {user.role === 'user' ? 'Create your first batch to get started.' : 'No batches assigned yet.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {batches.map((batch) => (
                        <div key={batch.id} className="card hover-effect" style={{ transition: 'transform 0.2s' }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold" style={{ color: 'var(--primary)' }}>{batch.product_type}</span>
                                <span className="text-sm flex items-center gap-1" style={{
                                    color: getStatusColor(batch.status),
                                    backgroundColor: `${getStatusColor(batch.status)}15`,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: 'var(--radius-full)'
                                }}>
                                    {getStatusIcon(batch.status)}
                                    {batch.status}
                                </span>
                            </div>

                            <div className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                <div>Quantity: {batch.quantity} {batch.unit}</div>
                                <div>Destination: {batch.destination}</div>
                                <div>Created: {new Date(batch.created_at).toLocaleDateString()}</div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    className="btn btn-outline w-full text-sm"
                                    onClick={() => navigate(`/batches/${batch.id}`)}
                                >
                                    View Details
                                </button>
                                {user.role === 'qa_agency' && (
                                    <button
                                        className="btn btn-primary w-full text-sm mt-2"
                                        onClick={() => navigate(`/verify/${batch.id}`)}
                                    >
                                        <CheckCircle size={16} />
                                        Verify Batch
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreateBatchModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchBatches();
                    }}
                />
            )}
        </div>
    );
};

export default Dashboard;
