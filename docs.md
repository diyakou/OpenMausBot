# راهنمای API مصرف، مدل‌ها، اشتراک و چت

این راهنما بر اساس کد فعلی پروژه است. `BASE_URL` آدرس سرور بدون `/v1` انتهایی است؛ برای مثال `https://YOUR_DOMAIN`. پاسخ‌های مثال خلاصه و مقادیر آن‌ها فرضی هستند. امکانات و سقف‌ها را از پاسخ واقعی سرور بخوانید.

## مسیرها و احراز هویت

| کاربرد | متد و مسیر | اعتبارنامه |
| --- | --- | --- |
| نمایش مصرف و پلن کلید | `GET /v1/usage` | API Key |
| سهمیه شناور پنج‌ساعته | `GET /v1/usage/five-hour` | API Key |
| تاریخچه مصرف | `GET /v1/usage/logs` | API Key |
| نمایش مدل‌ها | `GET /v1/models` | API Key یا توکن ورود کاربر |
| پلن‌های قابل ارائه | `GET /v1/plans` | بدون احراز هویت در این handler |
| اشتراک حساب کاربر | `GET /user/subscription/status` | توکن ورود کاربر |
| ارسال پیام با قالب Anthropic | `POST /v1/messages` | API Key |
| ارسال چت با قالب OpenAI | `POST /v1/chat/completions` | API Key |

برای gateway هدر `Authorization: Bearer YOUR_API_KEY` یا `x-api-key: YOUR_API_KEY` بفرستید. برای اشتراک حساب، `Authorization: Bearer USER_ACCESS_TOKEN` لازم است؛ این توکن با API Key تفاوت دارد. برای درخواست JSON هدر `Content-Type: application/json` بفرستید.

## ۱. نمایش مصرف

```bash
curl "$BASE_URL/v1/usage" -H "Authorization: Bearer $API_KEY"
```

مسیرهای `/v1/messages/usage`، `/v1/message/usage` و `/v1/token/usage` نیز همین handler را دارند.

نمونه خلاصه پاسخ کلید مدیریت‌شده:

```json
{
  "authenticated": true,
  "plan": "pro",
  "status": "active",
  "billing_mode": "subscription",
  "expires_at": "2026-12-01T00:00:00Z",
  "billing": {
    "unit": "weighted_compute_credit",
    "credits_used": 25000,
    "credits_limit": 100000,
    "credits_remaining": 75000,
    "remaining_percent": 75,
    "soft_limit_state": "normal"
  },
  "limits": {
    "rpm": 20,
    "concurrency": 3,
    "max_context_tokens": 200000,
    "max_output_tokens": 32000
  }
}
```

| فیلد | کاربرد در رابط کاربری |
| --- | --- |
| `plan`, `status`, `expires_at` | نام پلن، وضعیت و تاریخ انقضای کلید |
| `billing.credits_used/limit/remaining` | مصرف، سقف و مانده اعتبار محاسباتی |
| `billing.usage_percent`, `billing.remaining_percent` | درصد مصرف و مانده ماهانه |
| `billing.soft_limit_state` | یکی از `normal`, `notice`, `warning`, `critical`, `unavailable` |
| `billing.requests_used/limit/remaining` | تعداد درخواست مصرف‌شده و سهمیه ماهانه |
| `billing.five_hour_credits_*` | مصرف، رزرو، سقف و مانده اعتبار پنج‌ساعته |
| `daily_limit`, `used_today`, `remaining_today`, `reset_at` | سهمیه روزانه و زمان بازنشانی |
| `context` | ظرفیت ورودی و اندازه ورودی آخرین درخواست |
| `lifetime`, `last_request` | آمار تجمعی و آخرین درخواست |
| `limits` | سقف درخواست در دقیقه، هم‌زمانی، ورودی و خروجی |

اعتبار محاسباتی الزاماً برابر مجموع توکن خام ورودی و خروجی نیست؛ وزن مدل و cache بر صورتحساب اثر دارند. `null` برای مانده یا سقف را صفر نمایش ندهید؛ ممکن است سقفی تعریف نشده یا اطلاعات در دسترس نباشد. در پلن‌های `subscription` و `context_window` سهمیه روزانه کاربرد ندارد. ظرفیت context سهمیه مصرف دوره‌ای نیست.

کلیدهای ثابت یا غیرمدیریت‌شده ممکن است پاسخ کوتاه با `managed: false` و `limits: null` داشته باشند. برای جزئیات بیشتر مصرف، [مستند مصرف](../app/docs/API_USAGE_DOCUMENTATION_FA.md) را ببینید.

### وضعیت پنج‌ساعته

```bash
curl --get "$BASE_URL/v1/usage/five-hour" \
  -H "Authorization: Bearer $API_KEY" \
  --data-urlencode "model=YOUR_MODEL_ID"
```

پارامتر `model` اختیاری است. پاسخ شامل `scope` (`user` یا `api_key`)، `five_hour` و `models` است:

- `five_hour.credits`: شامل `limit`, `used`, `reserved`, `remaining`.
- `five_hour.requests`: شامل `limit`, `used`, `remaining`.
- `five_hour.limit_reached`: رسیدن به سقف؛ `enforced` و `exempt` وضعیت اعمال محدودیت را مشخص می‌کنند.
- `five_hour.next_release_at`: زمان آزاد شدن اولین مصرف؛ `window_clears_at`: زمان خروج آخرین مصرف فعلی از بازه.
- `models.last_served`: آخرین مدل ثبت‌شده؛ `next_request_expected`: پیش‌بینی مدل درخواست بعدی، نه تضمین.
- `models.quota_fallback_active`: فعال بودن جایگزین ناشی از سهمیه.

این بازه شناور است؛ سهمیه همه درخواست‌ها هم‌زمان در یک ساعت ثابت بازنشانی نمی‌شود.

### تاریخچه مصرف

```bash
curl "$BASE_URL/v1/usage/logs?page=1&page_size=20" \
  -H "Authorization: Bearer $API_KEY"
```

پارامترها: `page` از ۱، `page_size` از ۱ تا ۱۰۰، `status`، `model`، `from` و `to` با تاریخ ISO 8601، و `cursor` با شناسه مثبت. پاسخ شامل `data`, `total`, `page`, `page_size`, `next_cursor` است. هر ردیف شامل مدل، توکن ورودی/خروجی/cache، `customer_billable_tokens`، وضعیت، زمان و موجودی قبل/بعد است. تاریخچه برای کلید فراخواننده فیلتر می‌شود. برای پیمایش cursor، مقدار `next_cursor` را با `page=1` بفرستید. فیلدهای `requested_model` و `delivered_model` در این handler هر دو از مدل ثبت‌شده پر می‌شوند و `fallback` فعلاً ثابت `false` است؛ از آن‌ها برای تشخیص قطعی تغییر مدل استفاده نکنید.

## ۲. نمایش مدل‌ها

```bash
curl "$BASE_URL/v1/models" -H "Authorization: Bearer $API_KEY"
```

مسیرهای معادل: `/models`، `/v1/message/models` و `/v1/messages/models`.

پاسخ حاوی آرایه `data` است. مقدار دقیق `data[].id` را در انتخاب‌گر مدل ذخیره و به فیلد `model` درخواست ارسال کنید؛ فهرست را در فرانت‌اند ثابت ننویسید. فیلدهای تکمیلی مانند `name`، `capabilities` و `metadata` ممکن است بسته به مدل متفاوت باشند. پسوندی مانند `[x2]` ضریب مدل را نمایش می‌دهد؛ ضریب صورتحساب را سرور محاسبه می‌کند.

مدل مجازی `auto` در صورت فعال بودن در فهرست می‌آید و برای `/v1/messages` و `/v1/message` انتخاب خودکار Jev را فراهم می‌کند. گزینه‌های این انتخاب خودکار به پیشوندهای `hosh/`، `1hosh/`، `ox/`، `ag/`، `first/` و `j-gpt/` محدودند. این محدودیت مخصوص انتخاب خودکار است؛ فهرست عمومی مدل‌ها ممکن است پیشوندهای دیگری هم داشته باشد. `auto` را فقط برای endpointهای اعلام‌شده در `supported_endpoints` استفاده کنید.

## ۳. نمایش اشتراک

برای پلن و تاریخ انقضای API Key از `/v1/usage` یا `/v1/key/info` استفاده کنید. برای اشتراک حساب واردشده:

```bash
curl "$BASE_URL/user/subscription/status" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

```json
{
  "tier": "pro",
  "is_active": true,
  "expiry": "2026-12-01T00:00:00",
  "sku": "EXAMPLE_SKU",
  "entitlements": {},
  "auto_renew": false,
  "days_remaining": 14,
  "updated_at": "2026-11-01T00:00:00"
}
```

`entitlements` مجوزهای حساب است؛ محتوای آن را از پاسخ واقعی بخوانید. `expiry` و `updated_at` ممکن است `null` باشند. این handler زمان‌های ذخیره‌شده UTC را با `isoformat()` و بدون `Z` برمی‌گرداند؛ هنگام تبدیل برای نمایش محلی، آن‌ها را UTC تفسیر کنید. `days_remaining` تعداد روز کامل باقی‌مانده است. پاسخ اشتراک حساب با وضعیت پلن کلید API یکی نیست.

برای نمایش پلن‌های gateway:

```bash
curl "$BASE_URL/v1/plans"
```

پاسخ شامل `object: "list"`، توضیح `billing` و آرایه `data` است. سقف‌ها و قیمت‌ها را از داده فعلی سرور بخوانید.

## ۴. ارسال پیام با قالب Anthropic

مسیر اصلی `POST /v1/messages` و مسیر معادل آن `POST /v1/message` است.

```bash
curl "$BASE_URL/v1/message" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","max_tokens":1024,"system":"پاسخ‌ها را فارسی بنویس.","messages":[{"role":"user","content":"سلام"}],"stream":false}'
```

| فیلد | توضیح |
| --- | --- |
| `model` | شناسه مدل از فهرست یا `auto` در صورت فعال بودن |
| `messages` | آرایه پیام‌های `user` و `assistant` با `content` متنی یا بلوک‌های Anthropic |
| `max_tokens` | سقف خروجی؛ پیش‌فرض schema برابر ۱۰۲۴، تابع محدودیت پلن |
| `system` | دستور سیستم، جدا از آرایه پیام‌ها |
| `stream` | پیش‌فرض `false`؛ با `true` پاسخ SSE |
| `temperature`, `top_p`, `stop_sequences` | تنظیمات اختیاری تولید، وابسته به مسیر و مدل |
| `tools`, `tool_choice` | ابزارها با قالب Anthropic، وابسته به قابلیت مدل |

پاسخ غیرجریانی قالب پیام Anthropic دارد: `id`, `type: "message"`, `role: "assistant"`, `model`, `content`, `stop_reason`, `usage`. متن را از بلوک‌های `content` با `type: "text"` بخوانید؛ پاسخ ابزار می‌تواند بلوک `tool_use` داشته باشد. برای ادامه مکالمه، تاریخچه را در `messages` بفرستید.

با `stream: true` و `curl -N`، جریان SSE را رویدادبه‌رویداد بخوانید؛ رویدادهای معمول شامل `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop` هستند. کل بدنه جریان را یک JSON واحد parse نکنید.

## ۵. ارسال چت با قالب OpenAI

مسیر صحیح `POST /v1/chat/completions` است. مسیر معادل `/v1/chat/completion` نیز وجود دارد. مسیر `/chat/complation` در این قرارداد تعریف نشده است.

در مثال زیر `YOUR_MODEL_ID` را با شناسه واقعی فهرست جایگزین کنید:

```bash
curl "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"YOUR_MODEL_ID","messages":[{"role":"system","content":"پاسخ‌ها را فارسی بنویس."},{"role":"user","content":"سلام"}],"temperature":0.6,"stream":false}'
```

فیلدهای اصلی `model`، `messages`، `temperature` و `stream` هستند. ابزارها با `tools` و `tool_choice` قالب OpenAI ارسال می‌شوند؛ پشتیبانی را برای مدل انتخاب‌شده بررسی کنید. پذیرفته شدن پارامترهای اختیاری در schema به معنی اعمال همه آن‌ها روی همه مدل‌ها نیست.

نمونه خلاصه پاسخ:

```json
{
  "id": "chatcmpl-example",
  "object": "chat.completion",
  "model": "YOUR_MODEL_ID",
  "choices": [{"index": 0, "message": {"role": "assistant", "content": "سلام!"}, "finish_reason": "stop"}],
  "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
}
```

متن پاسخ از `choices[0].message.content` خوانده می‌شود. برای ابزارها `message.tool_calls` را نیز بررسی کنید. با `stream: true` پاسخ SSE شامل chunkهای `chat.completion.chunk` است؛ متن در `choices[].delta.content` می‌آید و پایان جریان با `data: [DONE]` مشخص می‌شود. قالب پیام و ابزار OpenAI را با قالب Anthropic مخلوط نکنید.

## خطاها و نکات نمایش

| کد | معنی معمول |
| --- | --- |
| `401` | اعتبارنامه نامعتبر یا مفقود |
| `403` | مدل یا قابلیت برای حساب مجاز نیست |
| `422` | ساختار درخواست یا پارامترها نامعتبر است |
| `429` | محدودیت نرخ، هم‌زمانی یا سهمیه؛ جزئیات پاسخ را بخوانید |
| `502` / `503` | اختلال سرویس بالادستی یا نبود مدل قابل استفاده |

پاسخ خطای معمول FastAPI حاوی `detail` است؛ نوع آن ممکن است رشته، شیء یا آرایه باشد. خطای پس از شروع جریان ممکن است داخل SSE منتقل شود. نمونه‌های این فایل قرارداد کامل همه خطاهای اختصاصی نیستند. زمان‌های دارای `Z` را UTC بخوانید و برای نمایش فارسی به منطقه کاربر تبدیل کنید.

منابع کد: `app/routers/gateway.py`، `app/routers/user.py`، `app/schemas.py`، `app/services/auto_model.py` و `app/services/five_hour_status.py`.

## ۶. صوت و تصویر با API Key پرومکس

کلید فعال پلن `pro_max`، `promx` یا `promax` می‌تواند از مسیرهای زیر استفاده کند. کلید نامعتبر `401` و پلن نامجاز یا منقضی `403` می‌گیرد. این مسیرها از `/v1/message` جدا هستند.

### سهمیه روزانه

| قابلیت | سقف |
| --- | --- |
| تولید تصویر | ۱۰ تصویر در روز؛ پارامتر `n` از این سهمیه کم می‌شود |
| چت صوتی WebSocket | ۳۰۰ ثانیه اتصال در روز، شامل زمان انتظار و سکوت |

روز در نیمه‌شب `Asia/Tehran` تغییر می‌کند. مصرف بین تمام API Keyهای یک کاربر مشترک و در دیتابیس ذخیره می‌شود؛ کلید بدون مالک برای تصویر سهمیه مستقل دارد. چت صوتی به مالک کاربری نیاز دارد. زمان صوت در قطعات ۵ ثانیه‌ای از ابتدای اتصال رزرو می‌شود؛ قطع زودهنگام نیز یک قطعه کامل مصرف می‌کند و اتصال‌های هم‌زمان سهمیه مشترک دارند. محدودیت صوت مخصوص ورود با API Key است؛ مسیر JWT سیاست اشتراک قبلی را دارد.

### تولید تصویر

```bash
curl "$BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"یک باغ ایرانی در نور صبح","n":1,"size":"1024x1024"}'
```

`model` اختیاری است. پاسخ provider اصلی آرایه `data` با `url` یا `b64_json` دارد. تعداد درخواست‌شده پیش از تولید رزرو می‌شود و در صورت خطای handler بازگردانده می‌شود. سقف تعداد رزروشده است؛ پاسخ کمتر از تعداد درخواستی نیز همان رزرو را مصرف می‌کند. با اتمام سهمیه، HTTP `429` و `detail.code: daily_media_limit` برمی‌گردد.

### تبدیل متن به صوت

```bash
curl "$BASE_URL/v1/audio/speech" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"سلام، چطور می‌توانم کمک کنم؟","response_format":"mp3"}' \
  --output speech.mp3
```

پاسخ باینری صوت است. این مسیر TTS مستقل است و از سهمیه مدت اتصال چت صوتی کسر نمی‌کند.

### چت صوتی

به `wss://YOUR_DOMAIN/v1/voice-chat` با هدر `Authorization: Bearer YOUR_API_KEY` یا `x-api-key` متصل شوید. برای مرورگر مسیر `wss://YOUR_DOMAIN/v1/voice-chat?key=YOUR_API_KEY` نیز پشتیبانی می‌شود؛ URL حاوی کلید را لاگ نکنید.

پس از `session.created`، صوت base64 ارسال کنید:

```json
{"type":"audio.append","audio":"BASE64_AUDIO_BYTES","mime":"audio/webm"}
```

سپس `{"type":"audio.commit"}` بفرستید. برای لغو پاسخ از `{"type":"cancel"}` و برای پاک کردن تاریخچه از `{"type":"history.clear"}` استفاده کنید. با پایان سهمیه، اتصال با کد `4403` بسته می‌شود؛ اتصال برقرارشده رویداد `error` با کد `daily_voice_limit` دریافت می‌کند. سرویس به پیکربندی STT، مدل مکالمه و TTS نیاز دارد.

سهمیه رسانه مستقل از صورتحساب توکنی `/v1/message` است.

### رویدادهای دریافتی چت صوتی

این قرارداد مربوط به `/v1/voice-chat` است. هر پیام یک JSON مستقل در فریم متنی WebSocket است؛ صوت نیز base64 در JSON ارسال می‌شود، نه فریم باینری. مقادیر نمونه‌اند و `BASE64_AUDIO_BYTES` باید با داده واقعی جایگزین شود.

شروع اتصال:

```json
{"type":"session.created","session_id":"vc_example","voice":"alloy","lang":"fa","tts_format":"mp3"}
```

برای ورودی صوتی، قبل از پاسخ دستیار این رویدادها می‌آیند:

```json
{"type":"transcript.started"}
{"type":"transcript.done","text":"سلام","lang":"fa"}
```

متن پاسخ به صورت تکه‌ای می‌آید. `text` هر `assistant.delta` را به متن فعلی اضافه کنید:

```json
{"type":"assistant.delta","text":"سلام! "}
{"type":"assistant.delta","text":"چطور می‌توانم کمک کنم؟"}
```

در پیاده‌سازی فعلی، پس از کامل شدن تولید متن، کل صدای پاسخ در یک پیام با `index: 0` می‌آید:

```json
{"type":"audio.delta","audio":"BASE64_AUDIO_BYTES","format":"mp3","index":0,"text":"سلام! چطور می‌توانم کمک کنم؟"}
```

`audio` را از base64 به بایت تبدیل و به عنوان یک فایل کامل با MIME متناظر با `format` پخش کنید؛ برای `mp3` از `audio/mpeg` استفاده کنید. این داده PCM خام نیست. نام `delta` به معنی قطعات قابل الحاق MP3 نیست؛ در نسخه فعلی یک فایل کامل صوتی می‌رسد.

سپس پایان متن، پایان صوت و پایان پردازش نوبت به این ترتیب می‌آیند:

```json
{"type":"assistant.done","text":"سلام! چطور می‌توانم کمک کنم؟"}
{"type":"audio.done","sentences":1}
{"type":"response.done","stats":{"response_index":0,"sentences":1,"assistant_chars":30}}
```

متن `assistant.done` نسخه کامل متن است؛ آن را جایگزین متن جمع‌شده کنید، دوباره به آن اضافه نکنید. `sentences` در کد فعلی تعداد آیتم صوتی تولیدشده، یعنی صفر یا یک است. `response_index` از صفر شروع می‌شود. `assistant_chars` طول متن کامل در سرور است؛ مقدار این مثال صرفاً نمایشی است. `response.done` پایان ارسال پاسخ سرور است؛ پایان پخش صوت در دستگاه را با رویداد پایان پخش player تشخیص دهید.

خطای معمول قالب زیر را دارد:

```json
{"type":"error","error":{"code":"turn_failed","message":"خطا در پردازش این نوبت","fatal":false}}
{"type":"response.done","stats":{"failed":true}}
```

در شکست TTS ممکن است متن‌های `assistant.delta` رسیده باشند ولی `assistant.done` یا صوت نرسد؛ متن جمع‌شده را نگه دارید و وضعیت شکست را نمایش دهید. هر خطای پروتکل مثل `busy` یا `bad_event` الزاماً با `response.done` همراه نیست. در خطای `fatal: true` انتظار بسته شدن اتصال را داشته باشید.

لغو نوبت در حال اجرا:

```json
{"type":"cancelling"}
{"type":"error","error":{"code":"cancelled","message":"پاسخ توسط کاربر لغو شد.","fatal":false}}
{"type":"response.done","stats":{"cancelled":true}}
```

اگر کاری در حال اجرا نباشد، پاسخ لغو `{"type":"cancelled","noop":true}` است. با لغو، صف پخش کلاینت را هم متوقف و پاک کنید. ورودی خالی یا transcript خالی می‌تواند پس از خطا با `{"type":"response.done","stats":{"empty":true}}` تمام شود.

خطای اتمام سهمیه هنگام اتصال، در نسخه فعلی استثنائاً `code` را در سطح اصلی می‌فرستد:

```json
{"type":"error","code":"daily_voice_limit","limit_seconds":300}
```

پس از آن اتصال با `4403` بسته می‌شود و دریافت `response.done` تضمین نیست. اگر سهمیه پیش از شروع جلسه تمام شده باشد، خطا قالب معمول `error.code` دارد و سپس اتصال بسته می‌شود. برای سازگاری، کد خطا را از `message.error?.code ?? message.code` بخوانید. در بسته شدن اتصال، وضعیت انتظار و صف صوت کلاینت را مستقل از دریافت رویداد پایان پاک کنید. رویدادها شناسه پاسخ مستقل ندارند؛ در هر جلسه تنها یک نوبت فعال نگه دارید.
