const db = require('../config/database');

class QAAgencyService {
  /**
   * Find best QA agency for a batch
   * Based on: specialization, workload, rating
   */
  async findBestQAAgency(batch) {
    try {
      const { product_type, destination } = batch;

      // Find active QA agencies that:
      // 1. Specialize in this product type (or handle all)
      // 2. Have capacity (current_load < max_capacity)
      // 3. Are active
      // Order by: lowest workload, then highest rating

      const result = await db.query(`
        SELECT 
          qa.*,
          (qa.max_capacity - qa.current_load) as available_capacity
        FROM qa_agencies qa
        WHERE qa.status = 'active'
          AND qa.current_load < qa.max_capacity
          AND (
            $1 = ANY(qa.specialization) 
            OR 'ALL' = ANY(qa.specialization)
          )
        ORDER BY 
          qa.current_load ASC,
          qa.rating DESC
        LIMIT 1
      `, [product_type]);

      if (result.rows.length === 0) {
        throw new Error('No available QA agency found for this product type');
      }

      return result.rows[0];

    } catch (error) {
      console.error('Error finding QA agency:', error);
      throw error;
    }
  }

  /**
   * Assign batch to QA agency
   */
  async assignBatchToQA(batchId, qaAgencyId, priority = 'normal') {
    try {
      if (!batchId || !qaAgencyId) {
      throw new Error('batchId and qaAgencyId are required');
    }
      // Create inspection request
      const requestResult = await db.query(`
        INSERT INTO inspection_requests (
          batch_id, 
          qa_agency_id, 
          status, 
          priority
        )
        VALUES ($1, $2, 'pending', $3)
        RETURNING *
      `, [batchId, qaAgencyId, priority]);

      const request = requestResult.rows[0];

      // Update batch status to 'assigned'
      await db.query(`
        UPDATE batches 
        SET status = 'assigned', updated_at = NOW()
        WHERE id = $1
      `, [batchId]);

      // Increment QA agency workload
      await db.query(`
        UPDATE qa_agencies 
        SET current_load = current_load + 1, updated_at = NOW()
        WHERE id = $1
      `, [qaAgencyId]);

      // Get QA agency user ID for notification
      const qaResult = await db.query(`
        SELECT user_id FROM qa_agencies WHERE id = $1
      `, [qaAgencyId]);

      if (qaResult.rows.length > 0) {
        await this.createNotification(
          qaResult.rows[0].user_id,
          'New Inspection Request',
          `You have been assigned a new batch (ID: ${batchId}) for quality inspection.`,
          'info',
          'inspection_request',
          request.id
        );
      }

      return request;

    } catch (error) {
      console.error('Error assigning batch:', error);
      throw error;
    }
  }

  /**
   * Create notification for user
   */
  async createNotification(userId, title, message, type = 'info', refType = null, refId = null) {
    try {
      await db.query(`
        INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          type, 
          reference_type, 
          reference_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, title, message, type, refType, refId]);

      console.log(`✅ Notification sent to user ${userId}`);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Auto-assign batch after creation
   */
  async autoAssignBatch(batch) {
    try {
      console.log(`🔍 Finding QA agency for batch ${batch.id}...`);

      // Find best QA agency
      const qaAgency = await this.findBestQAAgency(batch);

      console.log(`✅ Found QA agency: ${qaAgency.agency_name} (ID: ${qaAgency.id})`);

      // Assign batch to QA
      const request = await this.assignBatchToQA(batch.id, qaAgency.id);

      console.log(`✅ Batch ${batch.id} assigned to QA agency ${qaAgency.id}`);

      return {
        qaAgency,
        request
      };

    } catch (error) {
      console.error('Auto-assignment failed:', error);
      
      // Mark batch as 'assignment_failed'
      await db.query(`
        UPDATE batches 
        SET status = 'assignment_failed', updated_at = NOW()
        WHERE id = $1
      `, [batch.id]);

      throw error;
    }
  }

  /**
   * Get pending requests for a QA agency
   */
  async getPendingRequests(qaAgencyId) {
    try {
      const result = await db.query(`
        SELECT 
          ir.*,
          b.product_type,
          b.quantity,
          b.unit,
          b.destination,
          b.description,
          b.created_at as batch_created_at,
          u.full_name as exporter_name,
          u.email as exporter_email
        FROM inspection_requests ir
        JOIN batches b ON ir.batch_id = b.id
        JOIN users u ON b.exporter_id = u.id
        WHERE ir.qa_agency_id = $1
          AND ir.status = 'pending'
        ORDER BY ir.priority DESC, ir.requested_at ASC
      `, [qaAgencyId]);

      return result.rows;

    } catch (error) {
      console.error('Error getting pending requests:', error);
      throw error;
    }
  }

  /**
   * Accept inspection request
   */
  async acceptRequest(requestId, qaAgencyId, scheduledDate = null) {
    try {
      // Update request status
      const result = await db.query(`
        UPDATE inspection_requests
        SET 
          status = 'accepted',
          accepted_at = NOW(),
          scheduled_date = $3,
          updated_at = NOW()
        WHERE id = $1 AND qa_agency_id = $2
        RETURNING *
      `, [requestId, qaAgencyId, scheduledDate]);

      if (result.rows.length === 0) {
        throw new Error('Request not found or unauthorized');
      }

      const request = result.rows;

      // Update batch status
      await db.query(`
        UPDATE batches
        SET status = 'under_inspection', updated_at = NOW()
        WHERE id = $1
      `, [request.batch_id]);

      // Notify exporter
      const batchResult = await db.query(`
        SELECT exporter_id FROM batches WHERE id = $1
      `, [request.batch_id]);

      if (batchResult.rows.length > 0) {
        await this.createNotification(
          batchResult.rows.exporter_id,
          'Inspection Accepted',
          `Your batch (ID: ${request.batch_id}) has been accepted for inspection.`,
          'success',
          'batch',
          request.batch_id
        );
      }

      return request;

    } catch (error) {
      console.error('Error accepting request:', error);
      throw error;
    }
  }

  /**
   * Reject inspection request
   */
  async rejectRequest(requestId, qaAgencyId, reason) {
    try {
      // Update request status
      const result = await db.query(`
        UPDATE inspection_requests
        SET 
          status = 'rejected',
          rejected_at = NOW(),
          rejection_reason = $3,
          updated_at = NOW()
        WHERE id = $1 AND qa_agency_id = $2
        RETURNING *
      `, [requestId, qaAgencyId, reason]);

      if (result.rows.length === 0) {
        throw new Error('Request not found or unauthorized');
      }

      const request = result.rows;

      // Decrement QA agency workload
      await db.query(`
        UPDATE qa_agencies
        SET current_load = GREATEST(current_load - 1, 0), updated_at = NOW()
        WHERE id = $1
      `, [qaAgencyId]);

      // Try to reassign to another QA agency
      const batchResult = await db.query(`
        SELECT * FROM batches WHERE id = $1
      `, [request.batch_id]);

      if (batchResult.rows.length > 0) {
        const batch = batchResult.rows;
        
        // Update batch status back to submitted
        await db.query(`
          UPDATE batches
          SET status = 'submitted', updated_at = NOW()
          WHERE id = $1
        `, [batch.id]);

        // Try auto-assignment again (will find different QA)
        try {
          await this.autoAssignBatch(batch);
        } catch (error) {
          console.error('Reassignment failed:', error);
        }
      }

      return request;

    } catch (error) {
      console.error('Error rejecting request:', error);
      throw error;
    }
  }
}

module.exports = new QAAgencyService();
