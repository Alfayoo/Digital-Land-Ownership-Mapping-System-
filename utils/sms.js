const africastalking = require("africastalking");

const at = africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME, // usually "sandbox" for dev
});

const sms = at.SMS;

async function sendSMS(phoneNumber, message) {
  try {
    const formattedNumber = phoneNumber.startsWith("07")
      ? phoneNumber.replace(/^0/, "+254")
      : phoneNumber;

    const result = await sms.send({
      to: [formattedNumber],
      message,
    });
    console.log("SMS sent:", result);
  } catch (err) {
    console.error("Failed to send SMS:", err);
  }
}

module.exports = sendSMS;
const africastalking = require("africastalking");

const at = africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME, // usually "sandbox" for dev
});

const sms = at.SMS;

async function sendSMS(phoneNumber, message) {
  try {
    const formattedNumber = phoneNumber.startsWith("07")
      ? phoneNumber.replace(/^0/, "+254")
      : phoneNumber;

    const result = await sms.send({
      to: [formattedNumber],
      message,
    });
    console.log("SMS sent:", result);
  } catch (err) {
    console.error("Failed to send SMS:", err);
  }
}

module.exports = sendSMS;
