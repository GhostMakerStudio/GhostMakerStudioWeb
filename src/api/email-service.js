/**
 * Email Service
 * Handles sending emails via AWS SES (Simple Email Service)
 */

class EmailService {
  constructor() {
    // In real app, this would use AWS SES SDK
    this.fromEmail = 'orders@ghostmakerstudio.com';
    this.fromName = 'GhostMaker Studio';
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(orderData) {
    try {
      console.log('📧 Sending order confirmation email...');

      const templateData = {
        customerName: orderData.name.split(' ')[0], // First name only
        customerEmail: orderData.email,
        serviceName: orderData.service,
        orderId: orderData.orderId,
        amount: `$${orderData.price}`,
        orderDate: new Date(orderData.createdAt).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        trackingUrl: `https://ghostmakerstudio.com/track?token=${orderData.trackingToken}`,
        // For local testing:
        trackingUrlLocal: `http://localhost:3000/src/pages/order-tracking.html?token=${orderData.trackingToken}`
      };

      // Get email template
      const emailHTML = await this.getOrderConfirmationTemplate(templateData);

      // Send email via AWS SES
      const emailParams = {
        to: orderData.email,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `Order Confirmation #${orderData.orderId} - GhostMaker Studio`,
        html: emailHTML,
        text: this.generatePlainTextVersion(templateData)
      };

      await this.sendEmail(emailParams);

      console.log('✅ Order confirmation email sent successfully!');
      return templateData.trackingUrlLocal; // Return local URL for testing
    } catch (error) {
      console.error('❌ Failed to send order confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send draft ready notification
   */
  async sendDraftReadyNotification(orderData) {
    try {
      console.log('📧 Sending draft ready notification...');

      const emailParams = {
        to: orderData.email,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `🎨 Your ${orderData.service} Draft is Ready! - Order #${orderData.orderId}`,
        html: this.getDraftReadyTemplate(orderData),
        text: `Your ${orderData.service} draft is ready for review! View it at: https://ghostmakerstudio.com/track?token=${orderData.trackingToken}`
      };

      await this.sendEmail(emailParams);

      console.log('✅ Draft ready notification sent!');
    } catch (error) {
      console.error('❌ Failed to send draft ready notification:', error);
      throw error;
    }
  }

  /**
   * Send order complete notification
   */
  async sendOrderCompleteNotification(orderData) {
    try {
      console.log('📧 Sending order complete notification...');

      const emailParams = {
        to: orderData.email,
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `🎉 Your ${orderData.service} is Complete! - Order #${orderData.orderId}`,
        html: this.getOrderCompleteTemplate(orderData),
        text: `Your ${orderData.service} is complete! Download your files at: https://ghostmakerstudio.com/track?token=${orderData.trackingToken}`
      };

      await this.sendEmail(emailParams);

      console.log('✅ Order complete notification sent!');
    } catch (error) {
      console.error('❌ Failed to send order complete notification:', error);
      throw error;
    }
  }

  /**
   * Send creator notification (internal)
   */
  async sendCreatorNotification(orderData) {
    try {
      console.log('📧 Sending creator notification...');

      const emailParams = {
        to: 'creator@ghostmakerstudio.com', // Your mobile email
        from: `${this.fromName} <${this.fromEmail}>`,
        subject: `🔔 New Order: ${orderData.service} - #${orderData.orderId}`,
        html: this.getCreatorNotificationTemplate(orderData),
        text: `New order received!\n\nService: ${orderData.service}\nOrder ID: ${orderData.orderId}\nCustomer: ${orderData.name}\nAmount: $${orderData.price}\n\nView details: https://ghostmakerstudio.com/admin/orders/${orderData.orderId}`
      };

      await this.sendEmail(emailParams);

      console.log('✅ Creator notification sent!');
    } catch (error) {
      console.error('❌ Failed to send creator notification:', error);
      throw error;
    }
  }

  /**
   * Send actual email via AWS SES
   */
  async sendEmail(params) {
    // In real app, this would use AWS SES SDK:
    /*
    const AWS = require('aws-sdk');
    const ses = new AWS.SES({ region: 'us-east-1' });
    
    const sesParams = {
      Source: params.from,
      Destination: {
        ToAddresses: [params.to]
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: params.html,
            Charset: 'UTF-8'
          },
          Text: {
            Data: params.text,
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    return await ses.sendEmail(sesParams).promise();
    */

    // For now, simulate email sending
    console.log('📧 EMAIL DETAILS:');
    console.log('  From:', params.from);
    console.log('  To:', params.to);
    console.log('  Subject:', params.subject);
    console.log('  HTML Length:', params.html.length, 'characters');
    
    // Simulate network delay (real SES is typically 1-3 seconds)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      MessageId: 'ses_' + Date.now(),
      ResponseMetadata: { RequestId: 'request_' + Date.now() }
    };
  }

  /**
   * Load order confirmation template and replace placeholders
   */
  async getOrderConfirmationTemplate(data) {
    // In real app, this would load from src/email-templates/order-confirmation.html
    // and replace all {{placeholders}} with actual data
    
    // For now, return a simplified inline version
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; }
          .header { background: linear-gradient(135deg, #8b5cf6, #6d28d9); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 28px; }
          .body { padding: 32px 24px; }
          .order-box { background-color: #111827; border: 1px solid #374151; border-radius: 8px; padding: 20px; margin: 24px 0; }
          .order-number { color: #8b5cf6; font-size: 24px; font-weight: 700; font-family: monospace; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👻 GhostMaker Studio</h1>
            <p style="color: #e9d5ff; margin: 8px 0 0 0;">Professional Creative Services</p>
          </div>
          <div class="body">
            <p style="font-size: 18px;">Hey ${data.customerName},</p>
            <p style="color: #94a3b8;">Thanks for your order! We're excited to create your <strong style="color: #f8fafc;">${data.serviceName}</strong>.</p>
            
            <div class="order-box">
              <div class="order-number">#${data.orderId}</div>
              <p style="margin: 16px 0 8px 0;"><strong>Service:</strong> ${data.serviceName}</p>
              <p style="margin: 8px 0;"><strong>Amount:</strong> <span style="color: #10b981;">${data.amount}</span></p>
              <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: #f59e0b;">Content Pending</span></p>
            </div>
            
            <center>
              <a href="${data.trackingUrlLocal}" class="cta-button">Track Your Order</a>
            </center>
            
            <p style="color: #94a3b8; margin-top: 24px;">We'll send you updates as your order progresses. Click the button above to view status anytime!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getDraftReadyTemplate(data) {
    return `<p>Your draft is ready! View it at: ${data.trackingUrl}</p>`;
  }

  getOrderCompleteTemplate(data) {
    return `<p>Your order is complete! Download at: ${data.trackingUrl}</p>`;
  }

  getCreatorNotificationTemplate(data) {
    return `<p>New order: ${data.service} - ${data.orderId}</p>`;
  }

  generatePlainTextVersion(data) {
    return `
Hey ${data.customerName},

Thanks for your order! We're excited to create your ${data.serviceName}.

Order Details:
- Order ID: #${data.orderId}
- Service: ${data.serviceName}
- Amount: ${data.amount}
- Status: Content Pending

Track your order: ${data.trackingUrlLocal}

We'll send you updates as your order progresses.

- GhostMaker Studio
    `.trim();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailService;
}
