"""
ReelSnap Pro - Automated Telegram Downloader Bot
Listens for Instagram Reel links sent by Telegram users, extracts the link, 
and delivers 1-click 4K Ultra HD download links directing users to https://reelsnap-pro.onrender.com
"""

import asyncio
import httpx
import json
import logging
import os
import re
import urllib.parse

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ReelSnapTelegramBot")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
SITE_URL = "https://reelsnap-pro.onrender.com"

def get_bot_token():
    # 1. Environment variable
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if token:
        return token
    # 2. config.json
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                return cfg.get("telegram_bot_token", "").strip()
        except Exception:
            pass
    return ""

def extract_reel_url(text: str):
    match = re.search(r"https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)", text)
    if match:
        shortcode = match.group(1)
        return f"https://www.instagram.com/reel/{shortcode}/", shortcode
    return None, None

async def send_message(client: httpx.AsyncClient, token: str, chat_id: int, text: str, reply_markup=None):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        r = await client.post(url, json=payload, timeout=10.0)
        return r.json()
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return None

async def handle_update(client: httpx.AsyncClient, token: str, update: dict):
    message = update.get("message") or update.get("channel_post")
    if not message:
        return

    chat = message.get("chat", {})
    chat_id = chat.get("id")
    text = message.get("text", "").strip()
    user_name = message.get("from", {}).get("first_name", "Friend")

    if not chat_id or not text:
        return

    # Command: /start or /help
    if text.startswith("/start") or text.startswith("/help"):
        welcome_text = (
            f"👋 <b>Hello {user_name}! Welcome to ReelSnap Pro Bot!</b> ⚡\n\n"
            f"I can help you download <b>Instagram Reels, Videos & Stories</b> in original <b>4K / 1080p Ultra HD</b> without watermark!\n\n"
            f"📥 <b>How to use:</b>\n"
            f"Simply <b>send or forward any Instagram Reel link</b> to this chat, and I'll generate your instant download link!\n\n"
            f"🌐 <i>Visit website:</i> <a href='{SITE_URL}'>{SITE_URL}</a>"
        )
        markup = {
            "inline_keyboard": [
                [{"text": "🌐 Visit Website", "url": SITE_URL}],
                [{"text": "👑 Upgrade VIP (Ad-Free)", "url": f"{SITE_URL}#pricing"}]
            ]
        }
        await send_message(client, token, chat_id, welcome_text, markup)
        return

    # Check for Instagram Reel URL
    reel_url, shortcode = extract_reel_url(text)
    if reel_url:
        encoded_url = urllib.parse.quote(reel_url)
        web_download_link = f"{SITE_URL}/?url={encoded_url}"
        whatsapp_share_text = urllib.parse.quote(f"🔥 Download this Instagram Reel in 4K without watermark: {web_download_link}")
        whatsapp_url = f"https://api.whatsapp.com/send?text={whatsapp_share_text}"

        reply_text = (
            f"🎉 <b>Instagram Reel #{shortcode} Ready!</b> ⚡\n\n"
            f"✨ <b>Quality:</b> 1080p / 4K Full HD\n"
            f"🚫 <b>Watermark:</b> None (100% Clean)\n"
            f"⚡ <b>Speed:</b> Turbo High-Speed Stream\n\n"
            f"Click the button below to download your MP4 video file immediately:"
        )

        markup = {
            "inline_keyboard": [
                [{"text": "⚡ Download 4K Video (MP4) ⚡", "url": web_download_link}],
                [
                    {"text": "📲 Share on WhatsApp", "url": whatsapp_url},
                    {"text": "👑 VIP Ad-Free Pass", "url": f"{SITE_URL}#pricing"}
                ]
            ]
        }
        await send_message(client, token, chat_id, reply_text, markup)
    else:
        # Prompt user to paste a valid link
        help_reply = (
            f"⚠️ <b>Please send a valid Instagram Reel link.</b>\n\n"
            f"<i>Example:</i> <code>https://www.instagram.com/reel/C8q1_g-sQj3/</code>\n\n"
            f"Or visit our website directly: <a href='{SITE_URL}'>{SITE_URL}</a>"
        )
        await send_message(client, token, chat_id, help_reply)

async def run_telegram_bot():
    token = get_bot_token()
    if not token or token == "YOUR_TELEGRAM_BOT_TOKEN":
        logger.warning("=" * 60)
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN is not configured yet!")
        logger.warning("👉 To start the bot:")
        logger.warning("1. Open Telegram, search '@BotFather'")
        logger.warning("2. Type '/newbot' and follow instructions to get your Token")
        logger.warning("3. Paste token into config.json under 'telegram_bot_token'")
        logger.warning("   or set environment variable: TELEGRAM_BOT_TOKEN=<your_token>")
        logger.warning("=" * 60)
        return

    logger.info(f"🚀 ReelSnap Pro Telegram Bot Starting (Token: {token[:10]}...)...")
    offset = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Verify token with getMe
        try:
            r = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            me = r.json()
            if not me.get("ok"):
                logger.error(f"❌ Invalid Telegram Bot Token: {me.get('description')}")
                return
            bot_info = me.get("result", {})
            logger.info(f"✅ Bot connected successfully: @{bot_info.get('username')} ({bot_info.get('first_name')})")
        except Exception as e:
            logger.error(f"❌ Connection error verifying bot token: {e}")
            return

        logger.info("📡 Bot listening for incoming Instagram Reel requests...")
        while True:
            try:
                poll_url = f"https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=20"
                resp = await client.get(poll_url, timeout=35.0)
                if resp.status_code == 200:
                    data = resp.json()
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        asyncio.create_task(handle_update(client, token, update))
            except httpx.TimeoutException:
                pass
            except Exception as e:
                logger.warning(f"Telegram polling notice: {e}")
                await asyncio.sleep(2)

if __name__ == "__main__":
    try:
        asyncio.run(run_telegram_bot())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user.")
