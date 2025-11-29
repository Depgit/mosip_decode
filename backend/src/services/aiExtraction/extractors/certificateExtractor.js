const entityExtractor = require('../nlp/entityExtractor');

class CertificateExtractor {
    /**
     * Extract data from certificates
     */
    async extract(text, ocrData = {}) {
        const entities = entityExtractor.extract(text);

        const certificateData = {
            // Certificate details
            certificate_type: this.extractCertificateType(text),
            certificate_number: this.extractCertificateNumber(entities, text),
            iso_codes: this.extractISOCodes(entities, text),

            // Parties
            issued_to: this.extractIssuedTo(text),
            issued_by: this.extractIssuedBy(entities, text),

            // Dates
            issue_date: this.extractIssueDate(entities, text),
            expiry_date: this.extractExpiryDate(entities, text),

            // Status
            valid: this.checkValidity(text),
            scope: this.extractScope(text),
            accreditation: this.extractAccreditation(text),

            // Metadata
            raw_entities: entities,
            document_type: 'certificate'
        };

        certificateData.confidence = this.calculateConfidence(certificateData, entities);

        return certificateData;
    }

    /**
     * Extract certificate type
     */
    extractCertificateType(text) {
        const types = [
            { pattern: /iso\s*22000/i, type: 'ISO 22000 - Food Safety Management' },
            { pattern: /iso\s*9001/i, type: 'ISO 9001 - Quality Management' },
            { pattern: /iso\s*14001/i, type: 'ISO 14001 - Environmental Management' },
            { pattern: /haccp/i, type: 'HACCP Certification' },
            { pattern: /organic\s*certif/i, type: 'Organic Certification' },
            { pattern: /gmp/i, type: 'GMP Certification' },
            { pattern: /brc/i, type: 'BRC Certification' },
            { pattern: /fssc\s*22000/i, type: 'FSSC 22000' },
            { pattern: /global\s*gap/i, type: 'GlobalGAP' }
        ];

        for (const { pattern, type } of types) {
            if (pattern.test(text)) {
                return type;
            }
        }

        // Generic certificate
        const certMatch = text.match(/certificate\s*of\s*([^\n]+)/i);
        if (certMatch) {
            return certMatch[1].trim();
        }

        return 'Unknown Certificate';
    }

    /**
     * Extract certificate number
     */
    extractCertificateNumber(entities, text) {
        if (entities.certificate_number) {
            return entities.certificate_number.number;
        }
        return null;
    }

    /**
     * Extract ISO codes
     */
    extractISOCodes(entities, text) {
        if (entities.iso_codes && entities.iso_codes.length > 0) {
            return entities.iso_codes.map(iso => iso.code);
        }
        return null;
    }

    /**
     * Extract issued to (organization/person)
     */
    extractIssuedTo(text) {
        const patterns = [
            /(?:issued|granted|awarded)\s*to\s*:?\s*([A-Z][^\n]+)/i,
            /this\s*(?:is\s*to\s*)?certif(?:y|ies)\s*that\s*:?\s*([A-Z][^\n]+)/i,
            /certificate\s*holder\s*:?\s*([A-Z][^\n]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const name = match[1].trim();
                // Clean up common suffixes
                const cleaned = name.replace(/\s*has\s*successfully.*/i, '').trim();
                if (cleaned.length > 3 && cleaned.length < 200) {
                    return cleaned;
                }
            }
        }

        return null;
    }

    /**
     * Extract issued by (certifying body)
     */
    extractIssuedBy(entities, text) {
        const patterns = [
            /issued\s*by\s*:?\s*([A-Z][^\n]+)/i,
            /certifying\s*body\s*:?\s*([A-Z][^\n]+)/i,
            /certification\s*body\s*:?\s*([A-Z][^\n]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        // Try to extract from organizations
        if (entities.organizations && entities.organizations.length > 0) {
            // Look for certification-related organizations
            for (const org of entities.organizations) {
                if (org.name.toLowerCase().includes('certif') ||
                    org.name.toLowerCase().includes('accredit') ||
                    org.name.toLowerCase().includes('bureau')) {
                    return org.name;
                }
            }
        }

        return null;
    }

    /**
     * Extract issue date
     */
    extractIssueDate(entities, text) {
        const patterns = [
            /(?:issue|issued|grant|granted)\s*(?:date|on)?\s*:?\s*([^\n]+)/gi,
            /date\s*of\s*issue\s*:?\s*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this.parseDate(match[1].trim());
            }
        }

        // Check entities dates
        if (entities.dates && entities.dates.length > 0) {
            // Return first date as likely issue date
            return this.parseDate(entities.dates[0].raw);
        }

        return null;
    }

    /**
     * Extract expiry date
     */
    extractExpiryDate(entities, text) {
        const patterns = [
            /(?:expir(?:y|es|ation)|valid\s*until|valid\s*through)\s*(?:date)?\s*:?\s*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this.parseDate(match[1].trim());
            }
        }

        // Check entities dates
        if (entities.dates && entities.dates.length > 1) {
            const expDate = entities.dates.find(d => d.type === 'expiry_date');
            if (expDate) {
                return this.parseDate(expDate.raw);
            }
            // Return second date as likely expiry
            return this.parseDate(entities.dates[1].raw);
        }

        return null;
    }

    /**
     * Check if certificate is valid
     */
    checkValidity(text) {
        const lowerText = text.toLowerCase();

        // Check for explicit validity statements
        if (lowerText.includes('valid') && !lowerText.includes('invalid')) {
            return true;
        }

        if (lowerText.includes('revoked') || lowerText.includes('suspended') ||
            lowerText.includes('cancelled') || lowerText.includes('expired')) {
            return false;
        }

        // If we have "hereby certifies" or similar, it's likely valid
        if (lowerText.includes('hereby certif') || lowerText.includes('is certified')) {
            return true;
        }

        return null; // Unknown
    }

    /**
     * Extract certification scope
     */
    extractScope(text) {
        const patterns = [
            /scope\s*(?:of\s*certification)?\s*:?\s*([^\n]+(?:\n[^A-Z\n][^\n]+)*)/gi,
            /certified\s*for\s*:?\s*([^\n]+)/gi,
            /activities\s*covered\s*:?\s*([^\n]+)/gi
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const scope = match[0]
                    .replace(/scope\s*(?:of\s*certification)?\s*:?\s*/gi, '')
                    .replace(/certified\s*for\s*:?\s*/gi, '')
                    .replace(/activities\s*covered\s*:?\s*/gi, '')
                    .trim();

                if (scope.length > 10 && scope.length < 500) {
                    return scope;
                }
            }
        }

        return null;
    }

    /**
     * Extract accreditation information
     */
    extractAccreditation(text) {
        const patterns = [
            /accredited\s*by\s*:?\s*([A-Z][^\n]+)/i,
            /accreditation\s*(?:number|no\.?)?\s*:?\s*([A-Z0-9\-\/]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Parse date string
     */
    parseDate(dateStr) {
        try {
            // Remove common prefixes
            const cleaned = dateStr
                .replace(/^(issue|issued|expiry|expires|valid until|date of issue)\s*:?\s*/gi, '')
                .trim();

            const date = new Date(cleaned);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (error) {
            // Return raw string if parsing fails
        }
        return dateStr;
    }

    /**
     * Calculate confidence
     */
    calculateConfidence(certificateData, entities) {
        let foundFields = 0;
        let totalFields = 0;

        const importantFields = [
            'certificate_type',
            'certificate_number',
            'issued_to',
            'issued_by',
            'issue_date',
            'iso_codes'
        ];

        for (const field of importantFields) {
            totalFields++;
            if (certificateData[field]) {
                foundFields++;
            }
        }

        const baseConfidence = foundFields / totalFields;

        // Boost confidence if we have ISO codes or certificate number
        if (certificateData.iso_codes || certificateData.certificate_number) {
            return Math.min(baseConfidence + 0.15, 0.95);
        }

        return Math.min(baseConfidence, 0.9);
    }
}

module.exports = new CertificateExtractor();
