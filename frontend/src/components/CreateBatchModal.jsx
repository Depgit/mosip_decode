import { useState } from 'react';
import api from '../services/api';
import { X, Upload } from 'lucide-react';

const CreateBatchModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        productType: '',
        quantity: '',
        unit: 'kg',
        destination: '',
        description: ''
    });
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });

            files.forEach(file => {
                data.append('attachments', file);
            });

            await api.post('/batches', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create batch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg">Create New Batch</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: 'var(--error)',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="label">Product Type</label>
                        <input
                            type="text"
                            name="productType"
                            className="input"
                            value={formData.productType}
                            onChange={handleChange}
                            placeholder="e.g. Organic Apples"
                            required
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="w-full">
                            <label className="label">Quantity</label>
                            <input
                                type="number"
                                name="quantity"
                                className="input"
                                value={formData.quantity}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div style={{ width: '100px' }}>
                            <label className="label">Unit</label>
                            <select
                                name="unit"
                                className="input"
                                value={formData.unit}
                                onChange={handleChange}
                            >
                                <option value="kg">kg</option>
                                <option value="ton">ton</option>
                                <option value="box">box</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label">Destination</label>
                        <input
                            type="text"
                            name="destination"
                            className="input"
                            value={formData.destination}
                            onChange={handleChange}
                            placeholder="e.g. EU, USA"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Description</label>
                        <textarea
                            name="description"
                            className="input"
                            value={formData.description}
                            onChange={handleChange}
                            rows="3"
                        />
                    </div>

                    <div>
                        <label className="label">Attachments (Certificates, Lab Reports)</label>
                        <div style={{
                            border: '2px dashed var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            textAlign: 'center',
                            cursor: 'pointer'
                        }} onClick={() => document.getElementById('file-upload').click()}>
                            <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {files.length > 0 ? `${files.length} files selected` : 'Click to upload files'}
                            </div>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={onClose} className="btn btn-outline w-full">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Batch'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateBatchModal;
