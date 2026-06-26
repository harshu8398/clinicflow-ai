import nodemailer from "nodemailer";

const getTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"ClinicFlow AI" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Your ClinicFlow AI Reset Password Verification Code",
    text: `Your reset password verification code is: ${otp}. This code is valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">Reset Your Password</h2>
        <p>You requested a password reset for your clinic administrator account on ClinicFlow AI.</p>
        <p>Here is your 6-digit verification code (OTP):</p>
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #3b82f6;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendDemoRequestEmail(lead: {
  fullName: string;
  clinicName: string;
  mobileNumber: string;
  email: string;
  city: string;
}): Promise<void> {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"ClinicFlow AI" <${process.env.SMTP_USER}>`,
    to: "jha753430@gmail.com",
    subject: "New ClinicFlow Demo Request",
    text: `New demo request details:\n\nName: ${lead.fullName}\nClinic Name: ${lead.clinicName}\nMobile Number: ${lead.mobileNumber}\nEmail: ${lead.email}\nCity: ${lead.city}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">New Demo Request</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 130px;">Name:</td>
            <td style="padding: 8px 0; color: #0f172a;">${lead.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Clinic Name:</td>
            <td style="padding: 8px 0; color: #0f172a;">${lead.clinicName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Mobile Number:</td>
            <td style="padding: 8px 0; color: #0f172a;">${lead.mobileNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Email Address:</td>
            <td style="padding: 8px 0; color: #0f172a;">${lead.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">City:</td>
            <td style="padding: 8px 0; color: #0f172a;">${lead.city}</td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send demo request email:", err);
  }
}

export async function sendContactMessageEmail(message: {
  name: string;
  email: string;
  message: string;
  createdAt: Date;
}): Promise<void> {
  const transporter = getTransporter();

  const mailOptions = {
    from: `"ClinicFlow AI" <${process.env.SMTP_USER}>`,
    to: "jha753430@gmail.com",
    subject: "New Contact Message - ClinicFlow",
    text: `New contact message details:\n\nName: ${message.name}\nEmail: ${message.email}\nMessage: ${message.message}\nSubmitted Date: ${message.createdAt.toLocaleString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">New Contact Message</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 130px;">Name:</td>
            <td style="padding: 8px 0; color: #0f172a;">${message.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Email:</td>
            <td style="padding: 8px 0; color: #0f172a;">${message.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Submitted Date:</td>
            <td style="padding: 8px 0; color: #0f172a;">${message.createdAt.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569; vertical-align: top;">Message:</td>
            <td style="padding: 8px 0; color: #0f172a; white-space: pre-wrap;">${message.message}</td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send contact message email:", err);
  }
}


