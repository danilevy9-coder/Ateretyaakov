# DNS Migration — ateretyaakov.com → Vercel DNS

Captured 2026-06-03 from fComet (current authoritative NS: ns1/ns2.nw5.fcomet.com).
Registrar: **Launchpad.com** (change nameservers here).
Goal: move DNS hosting to Vercel, then add Resend email records.

## Current records (recreate ALL of these in Vercel DNS before switching nameservers)

| Type | Name | Value | Priority | Purpose | Keep? |
|---|---|---|---|---|---|
| A | @ | 76.76.21.21 | — | Website → Vercel | Vercel auto-adds |
| CNAME/A | www | cname.vercel-dns.com | — | Website → Vercel | Vercel auto-adds |
| MX | @ | nw5.fcomet.com | 10 | **Receiving email** | Only if keeping fComet email |
| TXT | @ | `v=spf1 +a +mx include:spf.mailjet.com ~all` | — | SPF (Mailjet send) | Yes |
| TXT | @ | `google-site-verification=Gdhc7lfYOswJ0DmRZWejpnOtNPxhhn62oSc0ElWslZ8` | — | Google verification | Yes |
| TXT | _dmarc | `v=DMARC1;p=none;sp=none;adkim=r;aspf=r;pct=100;fo=0;rf=afrf;ri=86400;rua=mailto:admin@ateretyaakov.com` | — | DMARC | Yes |
| TXT | mailjet._domainkey | `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6FFu5fGkxbfgu/9YM79a8eZM5fXe10Z9s5RBP+tJCn1BzA/k46GccjVq2zC94AfH9X3juZXdN6Umldar/21kFaZL1ITo4fahTr4d6WtEU5v9KaMdHyr7aQ4g/d0SzLtL6Cp5KTZcAVGgOqne3zIThVRRPk4z2TpXbdQ1bf3dWbwIDAQAB` | — | Mailjet DKIM | Yes |
| A | mail | 45.79.163.44 | — | Webmail/mail server | Only if keeping fComet email |
| A | webmail | 45.79.163.44 | — | Webmail | Only if keeping fComet email |
| A | cpanel | 45.79.163.44 | — | cPanel | Optional |
| A | autodiscover | 45.79.163.44 | — | Mail autodiscovery | Only if keeping fComet email |
| A | autoconfig | 45.79.163.44 | — | Mail autodiscovery | Only if keeping fComet email |

## NEW records to add (Resend email for the CRM)
Get exact values from Resend → Domains → ateretyaakov.com:
| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | resend._domainkey | `p=MIGfMA0...` (DKIM from Resend) | — |
| MX | send | `feedback-smtp.<region>.amazonses.com` | 10 |
| TXT | send | `v=spf1 include:amazonses.com ~all` | — |

## Cutover steps
1. In Vercel: add `ateretyaakov.com` to the project and choose **Vercel nameservers** (ns1.vercel-dns.com / ns2.vercel-dns.com).
2. In Vercel DNS: recreate every "Keep? = Yes" row above + add the 3 Resend rows.
3. At **Launchpad.com**: change the domain's nameservers to Vercel's.
4. Wait for propagation (a few hours, up to 48h).
5. In Resend: click **Verify**. In Vercel: set `RESEND_FROM_EMAIL` + `RESEND_REPLY_TO`, redeploy.
