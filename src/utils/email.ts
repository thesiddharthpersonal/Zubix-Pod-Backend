import nodemailer from 'nodemailer';

// Create transporter based on environment
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use real SMTP credentials
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: Use Ethereal (fake SMTP for testing)
    // Or return null to skip email sending in development
    return null;
  }
};

const transporter = createTransporter();

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    // In development, skip email sending if no transporter
    if (!transporter) {
      console.log('📧 [DEV] Email would be sent to:', options.to);
      console.log('📧 [DEV] Subject:', options.subject);
      console.log('📧 [DEV] Content:', options.text || options.html);
      return true;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Zubix" <noreply@zubix.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
};

export const sendOTPEmail = async (
  email: string,
  otp: string,
  userName?: string
): Promise<boolean> => {
  const subject = 'Password Reset OTP - Zubix';
  
  const text = `
Hello ${userName || 'User'},

You have requested to reset your password on Zubix.

Your OTP is: ${otp}

This OTP will expire in 15 minutes.

If you did not request this password reset, please ignore this email.

Best regards,
Zubix Team
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .otp-box {
      background: white;
      border: 2px dashed #667eea;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
      border-radius: 8px;
    }
    .otp-code {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${userName || 'User'}</strong>,</p>
      
      <p>You have requested to reset your password on <strong>Zubix</strong>.</p>
      
      <p>Please use the following One-Time Password (OTP) to complete your password reset:</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <div class="warning">
        ⚠️ <strong>Important:</strong> This OTP will expire in 15 minutes.
      </div>
      
      <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
      
      <p>For security reasons, never share this OTP with anyone.</p>
      
      <div class="footer">
        <p>Best regards,<br><strong>Zubix Team</strong></p>
        <p style="margin-top: 20px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: email, subject, text, html });
};
