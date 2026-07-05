import twilio from 'twilio';
import { isMock } from '../config/flags';
import { logger } from './logger';

// Todo el email vive en utils/email.ts; aquí solo queda SMS.
// Se re-exportan los helpers de email para no romper importadores existentes.
export {
  sendEmail,
  sendRentReminderEmail,
  sendContractRenewalNotification,
  notifyTenantProDecision,
} from './email';

const twilioConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER,
);

const forceMockSms = isMock(process.env.SMS_PROVIDER);
const twilioClient = !forceMockSms && twilioConfigured
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export const sendSms = async (phoneNumber: string, message: string) => {
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    } catch (error) {
      logger.error({ type: 'sms_error', to: phoneNumber, err: error }, 'Error enviando SMS');
    }
  } else {
    logger.info(
      { type: 'sms_mock', to: phoneNumber, forced: forceMockSms },
      'SMS no configurado; mensaje no enviado',
    );
  }
};

export const sendSMS = sendSms;
