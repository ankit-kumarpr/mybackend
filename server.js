require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Configure this properly for production
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication and join room
  socket.on('authenticate', (data) => {
    try {
      const { userId, token } = data;
      // You might want to verify the token here
      socket.join(`user_${userId}`);
      socket.userId = userId;
      console.log(`User ${userId} authenticated and joined room`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
    }
  });

  // Handle inquiry response (accept/reject)
  socket.on('inquiry_response', async (data) => {
    try {
      const { inquiryId, response, message } = data;
      const userId = socket.userId;
      
      // Update inquiry response
      const inquiry = await require('./models/Inquiry').findById(inquiryId);
      if (!inquiry) {
        socket.emit('error', { message: 'Inquiry not found' });
        return;
      }

      // Update inquiry status
      inquiry.status = response === 'accepted' ? 'accepted' : 'rejected';
      inquiry.responses = inquiry.responses || [];
      inquiry.responses.push({
        responder_id: userId,
        response: response,
        message: message,
        responded_at: new Date()
      });

      await inquiry.save();

      // Notify all other recipients
      const notification = {
        type: 'inquiry_response',
        data: {
          inquiry_id: inquiryId,
          responder_id: userId,
          response: response,
          message: message,
          updated_at: new Date()
        }
      };

      // Send to all recipients except the responder
      inquiry.recipients.vendors.forEach(vendor => {
        if (vendor.vendor_id.toString() !== userId.toString()) {
          io.to(`user_${vendor.vendor_id}`).emit('notification', notification);
        }
      });

      inquiry.recipients.individuals.forEach(individual => {
        if (individual.individual_id.toString() !== userId.toString()) {
          io.to(`user_${individual.individual_id}`).emit('notification', notification);
        }
      });

      socket.emit('response_success', { message: 'Response submitted successfully' });

    } catch (error) {
      console.error('Inquiry response error:', error);
      socket.emit('error', { message: 'Failed to submit response' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available globally for sending notifications
global.io = io;

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔌 Socket.IO server ready`);
});
