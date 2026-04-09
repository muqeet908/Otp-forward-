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

// telegram sender
async function sendTelegram(text) {
  await axios.post(
    `https://api.telegram.org/bot${BOT}/sendMessage`,
    {
      chat_id: GROUP,
      text
    }
  );
}

// login function
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

  console.log("Login Success");
  await sendTelegram("✅ IVASMS Logged In");
}

// OTP checker
let lastOTP = "";

async function checkOTP() {
  try {
    await page.goto(OTP_URL, { waitUntil: "networkidle2" });

    const otpText = await page.evaluate(() => {
      return document.body.innerText;
    });

    // detect 4-8 digit OTP
    const match = otpText.match(/\b\d{4,8}\b/);

    if (match && match[0] !== lastOTP) {
      lastOTP = match[0];

      await sendTelegram(
        `📩 NEW OTP RECEIVED\n\n🔐 OTP: ${lastOTP}`
      );

      console.log("OTP Sent:", lastOTP);
    }
  } catch (err) {
    console.log("OTP check error");
  }
}

// start bot
async function start() {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  page = await browser.newPage();

  await login();

  // check every 20 sec
  cron.schedule("*/20 * * * * *", checkOTP);

  // relogin every 30 min
  cron.schedule("*/30 * * * *", login);
}

start();
