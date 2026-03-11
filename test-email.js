require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendTestEmail() {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.PGA_EMAIL,
            pass: process.env.PGA_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.PGA_EMAIL,
        to: process.env.PRIMARY_EMAIL,
        subject: 'Test Email from MPBos',
        text: 'This is a test email sent from your MPBos system to verify the connection between your PGA.com and Gmail accounts.'
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

sendTestEmail();
