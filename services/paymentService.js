const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay (with fallback for development)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_key'
});

class PaymentService {
    constructor() {
        this.LEAD_PRICE = 900; // ₹9 in paise (Razorpay uses paise)
        this.isDevelopment = process.env.NODE_ENV === 'development' || 
                           !process.env.RAZORPAY_KEY_ID || 
                           process.env.RAZORPAY_KEY_ID === 'rzp_test_dummy_key';
    }

    // Create payment order for lead acceptance
    async createLeadPaymentOrder(userId, inquiryId, userDetails) {
        try {
            // Development mode - return mock order
            if (this.isDevelopment) {
                console.log(`[DEV MODE] Mock payment order created for user ${userId}, inquiry ${inquiryId}`);
                return {
                    success: true,
                    order_id: `mock_order_${Date.now()}`,
                    amount: this.LEAD_PRICE,
                    currency: 'INR',
                    receipt: `lead_${inquiryId}_${userId}_${Date.now()}`,
                    is_mock: true
                };
            }

            const orderOptions = {
                amount: this.LEAD_PRICE, // ₹9 in paise
                currency: 'INR',
                receipt: `lead_${inquiryId}_${userId}_${Date.now()}`,
                notes: {
                    inquiry_id: inquiryId,
                    user_id: userId,
                    user_name: userDetails.name,
                    user_email: userDetails.email,
                    payment_type: 'lead_acceptance'
                }
            };

            const order = await razorpay.orders.create(orderOptions);
            
            console.log(`Payment order created for user ${userId}, inquiry ${inquiryId}:`, order.id);
            
            return {
                success: true,
                order_id: order.id,
                amount: this.LEAD_PRICE,
                currency: 'INR',
                receipt: order.receipt
            };

        } catch (error) {
            console.error('Error creating payment order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Verify payment signature
    verifyPaymentSignature(paymentData) {
        try {
            // Development mode - always return success
            if (this.isDevelopment) {
                console.log(`[DEV MODE] Mock payment verification for order ${paymentData.razorpay_order_id}`);
                return {
                    success: true,
                    payment_id: paymentData.razorpay_payment_id || `mock_payment_${Date.now()}`,
                    order_id: paymentData.razorpay_order_id,
                    is_mock: true
                };
            }

            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
            
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            const isValid = expectedSignature === razorpay_signature;
            
            console.log(`Payment verification for order ${razorpay_order_id}: ${isValid ? 'Valid' : 'Invalid'}`);
            
            return {
                success: isValid,
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id
            };

        } catch (error) {
            console.error('Error verifying payment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get payment details
    async getPaymentDetails(paymentId) {
        try {
            const payment = await razorpay.payments.fetch(paymentId);
            return {
                success: true,
                payment: payment
            };
        } catch (error) {
            console.error('Error fetching payment details:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Refund payment (if needed)
    async refundPayment(paymentId, amount = null) {
        try {
            const refundOptions = {
                payment_id: paymentId,
                amount: amount || this.LEAD_PRICE, // Full refund by default
                notes: {
                    reason: 'Lead acceptance refund'
                }
            };

            const refund = await razorpay.payments.refund(paymentId, refundOptions);
            
            console.log(`Refund processed for payment ${paymentId}:`, refund.id);
            
            return {
                success: true,
                refund_id: refund.id,
                amount: refund.amount
            };

        } catch (error) {
            console.error('Error processing refund:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get lead price
    getLeadPrice() {
        return this.LEAD_PRICE;
    }

    // Get lead price in rupees
    getLeadPriceInRupees() {
        return this.LEAD_PRICE / 100; // Convert paise to rupees
    }
}

module.exports = new PaymentService();
