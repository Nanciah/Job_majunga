// src/services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.EMAIL_PASSWORD  // ← Depuis .env (mieux)
  }
});

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'nanciah05@gmail.com';

// ─── Fonction générique ───────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: '"JobMajunga" <nanciah05@gmail.com>',
    to,
    subject,
    html
  });
};

// ─── Email à l'admin quand un recruteur s'inscrit ─────────────────────────────
const sendRecruiterRequestEmail = async (recruiter) => {
  const approveUrl = `${BASE_URL}/admin/users/${recruiter.id}/approve?token=${recruiter.approval_token}`;
  const rejectUrl  = `${BASE_URL}/admin/users/${recruiter.id}/reject?token=${recruiter.approval_token}`;

  await transporter.sendMail({
    from: '"JobMajunga" <nanciah05@gmail.com>',
    to: ADMIN_EMAIL,
    subject: `🆕 Nouvelle demande recruteur — ${recruiter.company_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1D4ED8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">JobMajunga</h1>
          <p style="color: #BFDBFE; margin: 8px 0 0;">Nouvelle demande d'inscription recruteur</p>
        </div>
        <div style="background: #F8FAFC; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E293B;">Détails de la demande</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #64748B;">Entreprise</td>
              <td style="padding: 8px; color: #1E293B;">${recruiter.company_name}</td>
            </tr>
            <tr style="background: #F1F5F9;">
              <td style="padding: 8px; font-weight: bold; color: #64748B;">Email</td>
              <td style="padding: 8px; color: #1E293B;">${recruiter.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #64748B;">Date</td>
              <td style="padding: 8px; color: #1E293B;">${new Date().toLocaleString('fr-FR')}</td>
            </tr>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${approveUrl}" 
               style="background: #16A34A; color: white; padding: 14px 32px; 
                      border-radius: 8px; text-decoration: none; font-weight: bold;
                      margin-right: 16px; display: inline-block;">
              ✅ Approuver
            </a>
            <a href="${rejectUrl}" 
               style="background: #DC2626; color: white; padding: 14px 32px; 
                      border-radius: 8px; text-decoration: none; font-weight: bold;
                      display: inline-block;">
              ❌ Refuser
            </a>
          </div>
          <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
            Vous pouvez aussi gérer cette demande depuis le dashboard Admin de JobMajunga.
          </p>
        </div>
      </div>
    `
  });
};

// ─── Email au recruteur après approbation ─────────────────────────────────────
const sendApprovalEmail = async (email, companyName) => {
  await transporter.sendMail({
    from: '"JobMajunga" <nanciah05@gmail.com>',
    to: email,
    subject: '✅ Votre compte JobMajunga a été approuvé !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1D4ED8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">JobMajunga</h1>
        </div>
        <div style="background: #F8FAFC; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #16A34A;">🎉 Félicitations, ${companyName} !</h2>
          <p style="color: #1E293B;">Votre compte recruteur a été <strong>approuvé</strong>.</p>
          <p style="color: #1E293B;">Vous pouvez maintenant vous connecter à l'application JobMajunga Desktop et commencer à publier vos offres d'emploi.</p>
          <div style="margin-top: 24px; padding: 16px; background: #F0FDF4; border-radius: 8px; border-left: 4px solid #16A34A;">
            <p style="margin: 0; color: #16A34A; font-weight: bold;">✅ Compte activé avec succès</p>
          </div>
        </div>
      </div>
    `
  });
};

// ─── Email au recruteur après refus ───────────────────────────────────────────
const sendRejectionEmail = async (email, companyName) => {
  await transporter.sendMail({
    from: '"JobMajunga" <nanciah05@gmail.com>',
    to: email,
    subject: '❌ Votre demande JobMajunga n\'a pas été approuvée',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1D4ED8, #0EA5E9); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">JobMajunga</h1>
        </div>
        <div style="background: #F8FAFC; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #DC2626;">Demande non approuvée</h2>
          <p style="color: #c'est lancé1E293B;">Bonjour ${companyName},</p>
          <p style="color: #1E293B;">Nous sommes désolés, votre demande d'inscription n'a pas été approuvée par notre équipe.</p>
          <p style="color: #1E293B;">Pour plus d'informations, contactez-nous à <a href="mailto:nanciah05@gmail.com">nanciah05@gmail.com</a>.</p>
        </div>
      </div>
    `
  });
};

module.exports = {
  sendEmail,
  sendRecruiterRequestEmail,
  sendApprovalEmail,
  sendRejectionEmail
};