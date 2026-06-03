-- ════════════════════════════════════════════════════════════════════
-- Default message templates (English + Hebrew) for donor outreach.
-- Re-running replaces the DEFAULT templates only; user-created ones are kept.
-- Variables available: {{first_name}} {{full_name}} {{amount}} {{balance}}
--                      {{monthly_amount}} {{currency}} {{org}}
-- ════════════════════════════════════════════════════════════════════

delete from public.message_templates where is_default = true;

insert into public.message_templates (name, channel, language, category, subject, body, is_default) values

-- ── Unfulfilled pledge ──────────────────────────────────────────────
('Pledge reminder', 'email', 'en', 'unfulfilled_pledge',
 'A gentle reminder about your pledge to {{org}}',
 'Dear {{first_name}},

Thank you so much for your generous pledge to {{org}}. Our records show an outstanding balance of {{currency}}{{balance}} on your commitment.

Whenever it is convenient, you can complete your gift here: [DONATE LINK]

Your support directly sustains our talmidim and their growth in Torah. If you have any questions or if our records need updating, simply reply to this email.

With deep appreciation and blessing,
{{org}}', true),

('Pledge reminder', 'email', 'he', 'unfulfilled_pledge',
 'תזכורת ידידותית בנוגע להתחייבותך ל{{org}}',
 'יקירנו {{first_name}},

תודה רבה על התחייבותך הנדיבה ל{{org}}. לפי רישומינו נותרה יתרה לתשלום בסך {{currency}}{{balance}}.

בכל עת הנוחה לך ניתן להשלים את התרומה כאן: [DONATE LINK]

תמיכתך מחזיקה באופן ישיר את תלמידינו ואת גדילתם בתורה. לכל שאלה או עדכון פרטים, ניתן להשיב למייל זה.

בהוקרה ובברכה,
{{org}}', true),

-- ── Lapsed donor ────────────────────────────────────────────────────
('We miss you', 'email', 'en', 'lapsed',
 'We''ve missed you at {{org}}',
 'Dear {{first_name}},

It has been a while since we last heard from you, and we wanted to reach out. Your past support of {{org}} made a real difference, and we would be honored to have you partner with us again.

You can renew your support here: [DONATE LINK]

We would love to hear from you — just reply to this note.

Warm regards,
{{org}}', true),

('We miss you', 'email', 'he', 'lapsed',
 'התגעגענו אליך ב{{org}}',
 'יקירנו {{first_name}},

עבר זמן מאז ששמענו ממך, ורצינו ליצור קשר. תמיכתך בעבר ב{{org}} עשתה הבדל אמיתי, ויהיה לנו לכבוד לחדש את שותפותך עמנו.

ניתן לחדש את התמיכה כאן: [DONATE LINK]

נשמח מאוד לשמוע ממך — פשוט השב להודעה זו.

בברכה חמה,
{{org}}', true),

-- ── Failed / declined payment ───────────────────────────────────────
('Payment issue', 'email', 'en', 'failed_payment',
 'There was an issue with your recent payment to {{org}}',
 'Dear {{first_name}},

We tried to process your recent contribution of {{currency}}{{amount}} to {{org}}, but the payment did not go through. This usually happens when a card has expired or details have changed.

You can update your payment details and complete the gift here: [DONATE LINK]

Thank you for your continued partnership. Please reply if we can help in any way.

With gratitude,
{{org}}', true),

('Payment issue', 'email', 'he', 'failed_payment',
 'אירעה תקלה בתשלום האחרון שלך ל{{org}}',
 'יקירנו {{first_name}},

ניסינו לחייב את תרומתך האחרונה בסך {{currency}}{{amount}} ל{{org}}, אך התשלום לא עבר. לרוב הדבר קורה כאשר פג תוקף הכרטיס או שהפרטים השתנו.

ניתן לעדכן את פרטי התשלום ולהשלים את התרומה כאן: [DONATE LINK]

תודה על שותפותך המתמשכת. נשמח לסייע בכל דרך — פשוט השב להודעה.

בהכרת הטוב,
{{org}}', true),

-- ── Thank you (general) ─────────────────────────────────────────────
('Thank you', 'email', 'en', 'thank_you',
 'Thank you from {{org}}',
 'Dear {{first_name}},

Thank you for your generous gift of {{currency}}{{amount}} to {{org}}. Your partnership sustains our talmidim and their growth in Torah.

May you be blessed with all good.

Warmly,
{{org}}', true),

('Thank you', 'email', 'he', 'thank_you',
 'תודה מ{{org}}',
 'יקירנו {{first_name}},

תודה על תרומתך הנדיבה בסך {{currency}}{{amount}} ל{{org}}. שותפותך מחזיקה את תלמידינו ואת גדילתם בתורה.

תבורך בכל טוב.

בחום,
{{org}}', true),

-- ── WhatsApp short versions ─────────────────────────────────────────
('Pledge reminder', 'whatsapp', 'en', 'unfulfilled_pledge', null,
 'Hi {{first_name}}, this is {{org}}. A gentle reminder that {{currency}}{{balance}} remains on your generous pledge. You can complete it here: [DONATE LINK] — thank you so much!', true),

('Pledge reminder', 'whatsapp', 'he', 'unfulfilled_pledge', null,
 'שלום {{first_name}}, כאן {{org}}. תזכורת ידידותית שנותרה יתרה של {{currency}}{{balance}} מהתחייבותך הנדיבה. ניתן להשלים כאן: [DONATE LINK] — תודה רבה!', true),

('Payment issue', 'whatsapp', 'en', 'failed_payment', null,
 'Hi {{first_name}}, this is {{org}}. Your recent payment of {{currency}}{{amount}} didn''t go through — likely an expired card. You can update it here: [DONATE LINK]. Thank you!', true),

('Payment issue', 'whatsapp', 'he', 'failed_payment', null,
 'שלום {{first_name}}, כאן {{org}}. התשלום האחרון בסך {{currency}}{{amount}} לא עבר — ככל הנראה פג תוקף הכרטיס. ניתן לעדכן כאן: [DONATE LINK]. תודה!', true),

('We miss you', 'whatsapp', 'en', 'lapsed', null,
 'Hi {{first_name}}, this is {{org}}. We''ve missed you! We''d be honored to have you partner with us again: [DONATE LINK]', true),

('We miss you', 'whatsapp', 'he', 'lapsed', null,
 'שלום {{first_name}}, כאן {{org}}. התגעגענו אליך! נשמח מאוד לחדש את שותפותך: [DONATE LINK]', true);
