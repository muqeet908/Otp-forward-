import puppeteer from "puppeteer";
import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";
import { keepAlive } from "./server.js";

dotenv.config();
keepAlive();

const BOT = process.env.BOT_TOKEN;
const GROUP = process.env.GROUP_ID;
const EMAIL = process.env.IVASMS_EMAIL;
const PASSWORD = process.env.IVASMS_PASSWORD;
const OTP_URL = process.env.OTP_URL;

let browser, page;
let lastMessage = "";

/* ========= COUNTRY FLAG AUTO ========= */
function getCountryFlag(number) {
  const codes = {
    "+92": "🇵🇰 Pakistan",
    "+91": "🇮🇳 India",
    "+1": "🇺🇸 USA",
    "+44": "🇬🇧 UK",
    "+971": "🇦🇪 UAE",
    "+966": "🇸🇦 Saudi Arabia",
    "+880": "🇧🇩 Bangladesh",
    "+62": "🇮🇩 Indonesia",
    "+33": "🇫🇷 France",
    "+49": "🇩🇪 Germany",
    "+81": "🇯🇵 Japan"
  };

  for (let code in codes)
    if (number.startsWith(code)) return codes[code];

  return "🌍 Unknown Country";
}

/* ========= SERVICE DETECTOR ========= */
function detectService(text) {
  const services = [
    "WhatsApp",
    "Google",
    "Telegram",
    "Facebook",
    "Instagram",
    "TikTok",
    "Amazon",
    "PayPal",
    "Binance"
  ];

  for (let s of services)
    if (text.toLowerCase().includes(s.toLowerCase()))
      return s;

  return "Unknown Service";
}

/* ========= TELEGRAM MESSAGE ========= */
async function sendTelegram(data) {
  const flag = getCountryFlag(data.number);
  const service = detectService(data.message);

  const msg = `
<b>╔═══ 🔐 NEW OTP RECEIVED ═══╗</b>

${flag}

📱 <b>Number:</b>
<code>${data.number}</code>

🏢 <b>Service:</b> ${service}

🔑 <b>OTP:</b>
<code>${data.otp}</code>

💬 <b>Full Message:</b>
<blockquote>${data.message}</blockquote>

<b>Status:</b> ✅ Delivered
`;

  await axios.post(
    `https://api.telegram.org/bot${BOT}/sendMessage`,
    {
      chat_id: GROUP,
      parse_mode: "HTML",
      text: msg,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Copy OTP", callback_data: "copy_" + data.otp }]
        ]
      }
    }
  );
}

/* ========= LOGIN ========= */
async function login() {
  await page.goto("https://www.ivasms.com/login", {
    waitUntil: "networkidle2"
  });

  await page.type("input[name=email]", EMAIL);
  await page.type("input[name=password]", PASSWORD);

  await Promise.all([
    page.click("button[type=submit]"),
    page.waitForNavigation()
  ]);

  console.log("✅ Logged In");
}

/* ========= OTP SCANNER ========= */
async function checkSMS() {
  try {
    await page.goto(OTP_URL, { waitUntil: "networkidle2" });

    const sms = await page.evaluate(() => {
      const text = document.body.innerText;

      const otpMatch = text.match(/\b\d{4,8}\b/);
      const numMatch = text.match(/\+\d{8,15}/);

      return {
        otp: otpMatch ? otpMatch[0] : null,
        number: numMatch ? numMatch[0] : "Unknown",
        message: text.slice(0, 500)
      };
    });

    if (sms.otp && sms.message !== lastMessage) {
      lastMessage = sms.message;
      await sendTelegram(sms);
      console.log("✅ OTP Forwarded");
    }
  } catch (e) {
    console.log("Scan Error");
  }
}

/* ========= START ========= */
async function start() {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  page = await browser.newPage();

  await login();

  cron.schedule("*/15 * * * * *", checkSMS);
  cron.schedule("*/25 * * * *", login);
}

start();
