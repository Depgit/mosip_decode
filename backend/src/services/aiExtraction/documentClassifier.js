const path = require('path');

class DocumentClassifier {
    /**
     * Classify document based on filename, content, and file type
     */
    classify(filename, text = '', metadata = {}) {
        const lowerFilename = filename.toLowerCase();
        const lowerText = text.toLowerCase();

        // Check filename patterns
        const filenameType = this.classifyByFilename(lowerFilename);
        if (filenameType.confidence > 0.8) {
            return filenameType;
        }

        // Check content patterns
        const contentType = this.classifyByContent(lowerText);
        if (contentType.confidence > 0.7) {
            return contentType;
        }

        // Return the one with higher confidence
        return filenameType.confidence > contentType.confidence
            ? filenameType
            : contentType;
    }

    /**
     * Classify by filename patterns
     */
    classifyByFilename(filename) {
        const patterns = {
            lab_report: [
                /lab.*report/i,
                /test.*report/i,
                /analysis.*report/i,
                /quality.*test/i,
                /laboratory/i,
                /assay/i
            ],
            packaging: [
                /package/i,
                /packaging/i,
                /label/i,
                /box/i,
                /container/i
            ],
            certificate: [
                /certificate/i,
                /cert/i,
                /certification/i,
                /iso.*\d+/i,
                /compliance/i
            ],
            farming_data: [
                /farm/i,
                /harvest/i,
                /crop/i,
                /field.*data/i,
                /agricultural/i
            ]
        };

        for (const [type, patternList] of Object.entries(patterns)) {
            for (const pattern of patternList) {
                if (pattern.test(filename)) {
                    return {
                        type: type,
                        confidence: 0.85,
                        method: 'filename',
                        matched_pattern: pattern.toString()
                    };
                }
            }
        }

        return {
            type: 'unknown',
            confidence: 0.3,
            method: 'filename'
        };
    }

    /**
     * Classify by content analysis
     */
    classifyByContent(text) {
        if (!text || text.length < 50) {
            return {
                type: 'unknown',
                confidence: 0.2,
                method: 'content'
            };
        }

        const scores = {
            lab_report: this.scoreLabReport(text),
            packaging: this.scorePackaging(text),
            certificate: this.scoreCertificate(text),
            farming_data: this.scoreFarmingData(text)
        };

        // Find highest score
        let maxScore = 0;
        let maxType = 'unknown';

        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxType = type;
            }
        }

        return {
            type: maxType,
            confidence: Math.min(maxScore, 0.95),
            method: 'content',
            scores: scores
        };
    }

    /**
     * Score likelihood of being a lab report
     */
    scoreLabReport(text) {
        let score = 0;

        const keywords = [
            { term: 'laboratory', weight: 0.15 },
            { term: 'test result', weight: 0.15 },
            { term: 'analysis', weight: 0.1 },
            { term: 'moisture', weight: 0.15 },
            { term: 'pesticide', weight: 0.15 },
            { term: 'residue', weight: 0.1 },
            { term: 'sample', weight: 0.1 },
            { term: 'method', weight: 0.05 },
            { term: 'tested by', weight: 0.1 },
            { term: 'test date', weight: 0.1 },
            { term: 'ppm', weight: 0.1 },
            { term: 'mg/kg', weight: 0.1 }
        ];

        for (const { term, weight } of keywords) {
            if (text.includes(term)) {
                score += weight;
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Score likelihood of being packaging
     */
    scorePackaging(text) {
        let score = 0;

        const keywords = [
            { term: 'ingredients', weight: 0.2 },
            { term: 'net weight', weight: 0.15 },
            { term: 'manufactured', weight: 0.15 },
            { term: 'expiry', weight: 0.15 },
            { term: 'best before', weight: 0.15 },
            { term: 'batch', weight: 0.1 },
            { term: 'lot', weight: 0.1 },
            { term: 'organic', weight: 0.1 },
            { term: 'nutrition', weight: 0.1 },
            { term: 'storage', weight: 0.05 }
        ];

        for (const { term, weight } of keywords) {
            if (text.includes(term)) {
                score += weight;
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Score likelihood of being a certificate
     */
    scoreCertificate(text) {
        let score = 0;

        const keywords = [
            { term: 'certificate', weight: 0.2 },
            { term: 'certified', weight: 0.15 },
            { term: 'certification', weight: 0.15 },
            { term: 'iso ', weight: 0.2 },
            { term: 'hereby certif', weight: 0.2 },
            { term: 'valid until', weight: 0.15 },
            { term: 'issued by', weight: 0.1 },
            { term: 'accredited', weight: 0.1 },
            { term: 'compliance', weight: 0.1 },
            { term: 'standard', weight: 0.05 }
        ];

        for (const { term, weight } of keywords) {
            if (text.includes(term)) {
                score += weight;
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Score likelihood of being farming data
     */
    scoreFarmingData(text) {
        let score = 0;

        const keywords = [
            { term: 'harvest', weight: 0.15 },
            { term: 'crop', weight: 0.15 },
            { term: 'field', weight: 0.1 },
            { term: 'farm', weight: 0.15 },
            { term: 'yield', weight: 0.15 },
            { term: 'planting', weight: 0.1 },
            { term: 'irrigation', weight: 0.1 },
            { term: 'fertilizer', weight: 0.1 },
            { term: 'soil', weight: 0.1 },
            { term: 'season', weight: 0.05 }
        ];

        for (const { term, weight } of keywords) {
            if (text.includes(term)) {
                score += weight;
            }
        }

        return Math.min(score, 1.0);
    }

    /**
     * Quick classify (filename only)
     */
    quickClassify(filename) {
        return this.classifyByFilename(filename.toLowerCase());
    }
}

module.exports = new DocumentClassifier();
