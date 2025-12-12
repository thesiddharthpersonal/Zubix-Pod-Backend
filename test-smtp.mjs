import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'siddharthsk9001@gmail.com',
    pass: 'elklxcbrcfptvyuz'
  },
  debug: true,
  logger: true
});

console.log('🔍 Testing SMTP connection to Zoho...\n');

try {
  const verified = await transporter.verify();
  console.log('✅ SMTP Connection Successful!\n');
  
  console.log('📧 Sending test email...\n');
  const info = await transporter.sendMail({
    from: '"Zubix Test" <siddharthsk9001@gmail.com>',
    to: 'siddharthsk9001@gmail.com',
    subject: 'Test Email - Zubix OTP System',
    text: 'This is a test email from Zubix. Your test OTP is: 123456',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #667eea;">Test Email</h1>
        <p>This is a test email from <strong>Zubix OTP System</strong>.</p>
        <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;">Your test OTP is: <strong style="font-size: 24px; color: #667eea;">123456</strong></p>
        </div>
        <p style="color: #666;">If you received this email, the SMTP configuration is working correctly!</p>
      </div>
    `
  });
  
  console.log('✅ Email Sent Successfully!');
  console.log('📬 Message ID:', info.messageId);
  console.log('📨 Response:', info.response);
  console.log('\n✅ Check your inbox at contact@zubixapp.com');
  
} catch (error) {
  console.log('❌ Error occurred:');
  console.log('Error message:', error.message);
  if (error.code) console.log('Error code:', error.code);
  if (error.command) console.log('Failed command:', error.command);
  if (error.response) console.log('Server response:', error.response);
  console.log('\n📝 Full error:', error);
}

process.exit();
