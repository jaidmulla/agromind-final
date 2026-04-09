import axios from 'axios';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// MSG91 Integration — Send OTP via SMS to Indian phone numbers
// ────────────────────────────────────────────────────────────────────────────

const MSG91_API_URL = 'https://api.msg91.com/api/v5/otp';
const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

const OTP_MESSAGES: Record<string, string> = {
  en: 'Your KrishiSeva verification code is {OTP}. Valid for 5 minutes. Do not share.',
  hi: 'आपका कृषिसेवा सत्यापन कोड {OTP} है। 5 मिनट के लिए मान्य। साझा न करें।',
  mr: 'तुमचा कृषिसेवा सत्यापन कोड {OTP} आहे। 5 मिनिटांसाठी वैध. शेअर करू नका.',
  ta: 'உங்கள் கிருஷிசேவா சரிபார்ப்பு குறியீடு {OTP}. 5 நிமிடங்களுக்கு செல்லுபடி. பகிர வேண்டாம்.',
  te: 'మీ కృషిసేవా ధృవీకరణ కోడ్ {OTP}. 5 నిమిషాలకు చెల్లుబాటు. పంచుకోకండి.',
  kn: 'ನಿಮ್ಮ ಕೃಷಿಸೇವ ಪರಿಶೋಧನೆ ಕೋಡ್ {OTP}. 5 ನಿಮಿಷಗಳಿಗೆ ಮಾನ್ಯ. ಹಂಚಬೇಡಿ.',
  gu: 'તમારો કૃષિસેવા ચકાસણી કોડ {OTP} છે. 5 મિનિટ માટે માન્ય. શેર કરશો નહીં.',
  bn: 'আপনার কৃষিসেবা যাচাইকরণ কোড {OTP}। 5 মিনিটের জন্য বৈধ। শেয়ার করবেন না।',
  pa: 'ਤੁਹਾਡਾ ਕ੍ਰਿਸ਼ੀਸੇਵਾ ਤਸਦੀਕ ਕੋਡ {OTP} ਹੈ। 5 ਮਿੰਟ ਲਈ ਪ੍ਰਮਾਣਿਕ। ਸਾਂਝਾ ਨਾ ਕਰੋ।',
};

interface SendOTPResponse {
  success: boolean;
  message: string;
  requestId?: string;
}

/**
 * Send OTP via MSG91 API
 */
export const sendOTPViaMSG91 = async (
  phone: string,
  otp: string,
  language: string = 'en',
): Promise<SendOTPResponse> => {
  try {
    // Validate credentials
    if (!AUTH_KEY || !TEMPLATE_ID) {
      logger.warn('MSG91 credentials not configured. Using console fallback.');
      return sendOTPConsole(phone, otp, language);
    }

    // Ensure phone number has country code (India: 91)
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;

    // Get OTP message in selected language
    const message = OTP_MESSAGES[language] || OTP_MESSAGES['en'];
    const smsText = message.replace('{OTP}', otp);

    // Make API request to MSG91
    const response = await axios.post(
      MSG91_API_URL,
      {
        template_id: TEMPLATE_ID,
        mobile: formattedPhone,
        otp: otp,
      },
      {
        headers: {
          authkey: AUTH_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    logger.info(`OTP sent via MSG91 to ${phone}:`, {
      status: response.status,
      requestId: response.data?.request_id,
    });

    return {
      success: response.status === 200,
      message: 'OTP sent successfully via SMS',
      requestId: response.data?.request_id,
    };
  } catch (error) {
    logger.error('Error sending OTP via MSG91:', error);

    // Fallback to console logging
    logger.warn('Falling back to console OTP logging');
    return sendOTPConsole(phone, otp, language);
  }
};

/**
 * Fallback: Log OTP to console (for development/testing)
 */
const sendOTPConsole = (phone: string, otp: string, language: string = 'en'): SendOTPResponse => {
  const message = OTP_MESSAGES[language] || OTP_MESSAGES['en'];
  const smsText = message.replace('{OTP}', otp);

  console.log('\n════════════════════════════════════════════════════');
  console.log(`📱 SMS to ${phone} (${language.toUpperCase()})`);
  console.log('════════════════════════════════════════════════════');
  console.log(smsText);
  console.log('════════════════════════════════════════════════════\n');

  logger.info(`[DEV MODE] OTP logged to console for ${phone}`);

  return {
    success: true,
    message: 'OTP logged to console (development mode)',
  };
};

/**
 * Verify OTP via MSG91 API (if MSG91 provides verification endpoint)
 * Note: Currently we're verifying against our Redis hash, not MSG91
 */
export const verifyOTPViaMSG91 = async (phone: string, otp: string): Promise<SendOTPResponse> => {
  try {
    // MSG91 provides verification endpoint but we use our own verification
    // This is kept for potential future use
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;

    const response = await axios.post(
      'https://api.msg91.com/api/v5/otp/verify',
      {
        mobile: formattedPhone,
        otp: otp,
      },
      {
        headers: {
          authkey: AUTH_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    return {
      success: response.status === 200,
      message: 'OTP verified via MSG91',
    };
  } catch (error) {
    logger.error('Error verifying OTP via MSG91:', error);
    return {
      success: false,
      message: 'Failed to verify OTP with SMS provider',
    };
  }
};

export default {
  sendOTPViaMSG91,
  verifyOTPViaMSG91,
};
