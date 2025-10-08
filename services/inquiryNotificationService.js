const Inquiry = require('../models/Inquiry');
const User = require('../models/User');

// Real-time notification system for inquiries
class InquiryNotificationService {
    constructor() {
        this.activeConnections = new Map(); // userId -> WebSocket connection
    }

    // Add WebSocket connection for a user
    addConnection(userId, connection) {
        this.activeConnections.set(userId.toString(), connection);
        console.log(`User ${userId} connected for notifications`);
    }

    // Remove WebSocket connection for a user
    removeConnection(userId) {
        this.activeConnections.delete(userId.toString());
        console.log(`User ${userId} disconnected from notifications`);
    }

    // Send real-time notification to specific user
    sendNotificationToUser(userId, notification) {
        const connection = this.activeConnections.get(userId.toString());
        if (connection && connection.readyState === 1) { // WebSocket.OPEN
            connection.send(JSON.stringify(notification));
            console.log(`Notification sent to user ${userId}`);
            return true;
        }
        return false;
    }

    // Send inquiry notification to all relevant recipients
    async sendInquiryNotification(inquiry) {
        try {
            const notification = {
                type: 'new_inquiry',
                data: {
                    inquiry_id: inquiry._id,
                    user_name: inquiry.user_name,
                    user_phone: inquiry.user_phone,
                    search_query: inquiry.search_query,
                    inquiry_message: inquiry.inquiry_message,
                    user_location: inquiry.user_location,
                    created_at: inquiry.createdAt,
                    priority: inquiry.priority
                },
                timestamp: new Date().toISOString()
            };

            // Send to all vendor recipients
            for (const vendor of inquiry.recipients.vendors) {
                const sent = this.sendNotificationToUser(vendor.vendor_id, notification);
                if (!sent) {
                    // If user is not online, you might want to store notification for later
                    await this.storeOfflineNotification(vendor.vendor_id, notification);
                }
            }

            // Send to all individual recipients
            for (const individual of inquiry.recipients.individuals) {
                const sent = this.sendNotificationToUser(individual.individual_id, notification);
                if (!sent) {
                    // If user is not online, you might want to store notification for later
                    await this.storeOfflineNotification(individual.individual_id, notification);
                }
            }

            console.log(`Inquiry notifications sent to ${inquiry.recipients.vendors.length} vendors and ${inquiry.recipients.individuals.length} individuals`);

        } catch (error) {
            console.error('Error sending inquiry notifications:', error);
        }
    }

    // Store notification for offline users (optional)
    async storeOfflineNotification(userId, notification) {
        try {
            // You can implement a notification storage system here
            // For now, we'll just log it
            console.log(`Storing offline notification for user ${userId}`);
            
            // Example: Store in database for later retrieval
            // await Notification.create({
            //     user_id: userId,
            //     type: notification.type,
            //     data: notification.data,
            //     read: false,
            //     created_at: new Date()
            // });
        } catch (error) {
            console.error('Error storing offline notification:', error);
        }
    }

    // Send inquiry response notification
    async sendResponseNotification(inquiryId, responderId, responseStatus) {
        try {
            const inquiry = await Inquiry.findById(inquiryId);
            if (!inquiry) return;

            const notification = {
                type: 'inquiry_response',
                data: {
                    inquiry_id: inquiry._id,
                    search_query: inquiry.search_query,
                    responder_id: responderId,
                    response_status: responseStatus,
                    updated_at: new Date()
                },
                timestamp: new Date().toISOString()
            };

            // Send to inquiry submitter (if they have an account)
            // You might want to implement user lookup by email/phone
            // For now, we'll send to all other recipients
            
            // Send to other vendors
            for (const vendor of inquiry.recipients.vendors) {
                if (vendor.vendor_id.toString() !== responderId.toString()) {
                    this.sendNotificationToUser(vendor.vendor_id, notification);
                }
            }

            // Send to other individuals
            for (const individual of inquiry.recipients.individuals) {
                if (individual.individual_id.toString() !== responderId.toString()) {
                    this.sendNotificationToUser(individual.individual_id, notification);
                }
            }

        } catch (error) {
            console.error('Error sending response notification:', error);
        }
    }

    // Get active connections count
    getActiveConnectionsCount() {
        return this.activeConnections.size;
    }

    // Get connected users
    getConnectedUsers() {
        return Array.from(this.activeConnections.keys());
    }

    // Broadcast to all connected users
    broadcastToAll(notification) {
        for (const [userId, connection] of this.activeConnections) {
            if (connection.readyState === 1) {
                connection.send(JSON.stringify(notification));
            }
        }
    }
}

// Create singleton instance
const inquiryNotificationService = new InquiryNotificationService();

module.exports = inquiryNotificationService;
