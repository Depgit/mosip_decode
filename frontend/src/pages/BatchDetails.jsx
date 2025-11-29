import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Package, FileText, Calendar, MapPin, CheckCircle, XCircle, Clock, Download } from 'lucide-react';

const BatchDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [batch, setBatch] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchBatchDetails = async () => {
            try {
                const response = await api.get(`/batches/${id}`);
                setBatch(response.data.data.batch);
                setAttachments(response.data.data.attachments);
            } catch (err) {
                setError('Failed to load batch details');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBatchDetails();
    }, [id]);

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
            case 'approved': return <CheckCircle size={20} />;
            case 'rejected': return <XCircle size={20} />;
            default: return <Clock size={20} />;
        }
    };

    const handleDownload = async (filename, originalName) => {
        try {
            const response = await api.get(`/batches/file/${filename}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', originalName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download file');
        }
    };

    if (loading) return <div className="text-center py-8">Loading details...</div>;
    if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
    if (!batch) return <div className="text-center py-8">Batch not found</div>;

    return (
        <div>
            <button
                onClick={() => navigate(-1)}
                className="btn btn-outline mb-4"
                style={{ border: 'none', paddingLeft: 0 }}
            >
                <ArrowLeft size={18} /> Back to Dashboard
            </button>

            <div className="card mb-6">
                <div className="flex items-center justify-between mb-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <div>
                        <h1 className="font-bold text-lg flex items-center gap-2">
                            <Package className="text-primary" />
                            {batch.product_type}
                        </h1>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Batch ID: {batch.id}</span>
                    </div>

                    <div className="flex items-center gap-2" style={{
                        color: getStatusColor(batch.status),
                        backgroundColor: `${getStatusColor(batch.status)}15`,
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: '500'
                    }}>
                        {getStatusIcon(batch.status)}
                        <span style={{ textTransform: 'capitalize' }}>{batch.status}</span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                    <div>
                        <label className="label" style={{ color: 'var(--text-secondary)' }}>Quantity</label>
                        <div className="font-bold text-lg">{batch.quantity} {batch.unit}</div>
                    </div>

                    <div>
                        <label className="label" style={{ color: 'var(--text-secondary)' }}>Destination</label>
                        <div className="flex items-center gap-2">
                            <MapPin size={18} style={{ color: 'var(--text-secondary)' }} />
                            {batch.destination}
                        </div>
                    </div>

                    <div>
                        <label className="label" style={{ color: 'var(--text-secondary)' }}>Created Date</label>
                        <div className="flex items-center gap-2">
                            <Calendar size={18} style={{ color: 'var(--text-secondary)' }} />
                            {new Date(batch.created_at).toLocaleDateString()}
                        </div>
                    </div>

                    <div>
                        <label className="label" style={{ color: 'var(--text-secondary)' }}>Assigned Agency</label>
                        <div className="font-bold text-lg">
                            {batch.agency_name || 'Pending Assignment'}
                        </div>
                    </div>
                </div>

                {batch.description && (
                    <div className="mt-6">
                        <label className="label" style={{ color: 'var(--text-secondary)' }}>Description</label>
                        <p style={{ backgroundColor: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                            {batch.description}
                        </p>
                    </div>
                )}
            </div>

            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <FileText size={20} />
                Attachments
            </h2>

            {attachments.length === 0 ? (
                <div className="card text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No attachments uploaded for this batch.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    {attachments.map((file) => (
                        <div key={file.id} className="card flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div style={{
                                    backgroundColor: 'var(--background)',
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <FileText size={24} style={{ color: 'var(--primary)' }} />
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div className="font-bold text-sm truncate" title={file.original_name}>
                                        {file.original_name}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {(file.file_size / 1024).toFixed(1)} KB
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleDownload(file.file_name, file.original_name)}
                                className="btn btn-outline"
                                style={{ padding: '0.5rem', borderRadius: 'var(--radius-full)' }}
                                title="Download"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BatchDetails;
