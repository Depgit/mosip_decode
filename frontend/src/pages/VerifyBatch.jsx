import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const VerifyBatch = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        status: 'passed', // passed, failed
        moistureLevel: '',
        pesticideContent: '',
        qualityRating: 5,
        notes: ''
    });

    useEffect(() => {
        const fetchBatch = async () => {
            try {
                const response = await api.get(`/batches/${id}`);
                setBatch(response.data.data.batch);
            } catch (err) {
                console.error(err);
                alert('Failed to load batch details');
            } finally {
                setLoading(false);
            }
        };
        fetchBatch();
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post(`/inspections/${id}`, formData);
            alert('Inspection submitted successfully');
            navigate('/');
        } catch (err) {
            console.error(err);
            alert('Failed to submit inspection');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!batch) return <div>Batch not found</div>;

    return (
        <div>
            <button onClick={() => navigate(-1)} className="btn btn-outline mb-4">
                <ArrowLeft size={18} /> Back
            </button>

            <div className="card max-w-2xl mx-auto">
                <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <CheckCircle className="text-primary" />
                    Verify Batch: {batch.product_type}
                </h1>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-500">Quantity:</span> {batch.quantity} {batch.unit}</div>
                        <div><span className="text-gray-500">Destination:</span> {batch.destination}</div>
                        <div><span className="text-gray-500">Exporter:</span> {batch.exporter_id}</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="label">Inspection Result</label>
                        <div className="flex gap-4">
                            <label className={`flex items-center gap-2 p-3 rounded border cursor-pointer flex-1 ${formData.status === 'passed' ? 'border-green-500 bg-green-50' : ''}`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value="passed"
                                    checked={formData.status === 'passed'}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                />
                                <CheckCircle size={18} className="text-green-600" />
                                <span className="font-medium">Pass</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded border cursor-pointer flex-1 ${formData.status === 'failed' ? 'border-red-500 bg-red-50' : ''}`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value="failed"
                                    checked={formData.status === 'failed'}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                />
                                <XCircle size={18} className="text-red-600" />
                                <span className="font-medium">Fail</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Moisture Level (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input"
                                value={formData.moistureLevel}
                                onChange={e => setFormData({ ...formData, moistureLevel: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Pesticide Content (ppm)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.pesticideContent}
                                onChange={e => setFormData({ ...formData, pesticideContent: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Quality Rating (1-5)</label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            className="w-full"
                            value={formData.qualityRating}
                            onChange={e => setFormData({ ...formData, qualityRating: parseInt(e.target.value) })}
                        />
                        <div className="text-center font-bold">{formData.qualityRating} / 5</div>
                    </div>

                    <div>
                        <label className="label">Inspection Notes</label>
                        <textarea
                            className="input"
                            rows="4"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Enter detailed inspection findings..."
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Verification'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VerifyBatch;
