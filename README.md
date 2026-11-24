# MagisterPro

Een "Student Operating System" voor Nederlandse middelbare scholieren: een modern alternatief voor Magister/Zermelo met cijferanalyse, rooster, toetsplanner en een echte koppeling naar beide schoolsystemen.

## Modules

- **Command Center** — live-lestracker, actie-radar en cijfer-impactfeed.
- **Cijferstudio Pro** — vakkaarten, "wat moet ik halen?", multi-vak sandbox, slaag/zak-check volgens de officiële regels, analytics en een cijfer-recordboek.
- **Super-Rooster** — dag-/week-/maand-/agendaweergave, Zermelo Hub, KWT-inschrijving met capaciteit en conflictdetectie, tussenuur-optimizer en `.ics`-export.
- **PTA & Examenkluis** — voortgang per PTA-kolom, schoolexamen-gemiddelde en een herkansings-adviseur gesorteerd op rendement.
- **Toets- & Huiswerkplanner** — Kanban met drag-and-drop, automatisch terugrekenend leerplan, tijdblokkades en een Pomodoro/XP-focusdock met omgevingsgeluid.
- **Studiewijzer & ELO** — studiewijzers, inleveropdrachten en markdown-notities per vak.
- **Berichten & gids** — inbox, berichten verzenden en een automatisch opgebouwde docenten-/lokalen-gids.
- **Aanwezigheid & Wrapped** — verzuimanalyse, aanwezigheidsring en een schooljaaroverzicht.

## Koppeling

Er is **geen demo-modus**: de app begint op `/login` en toont uitsluitend echte schoolgegevens.

- **Magister** — standaard OAuth2 met PKCE via een eigen, bij Magister geregistreerde webclient. Je wordt doorgestuurd naar `accounts.magister.net` en logt daar in; MagisterPro vraagt nooit naar je wachtwoord. De code komt terug op `/auth/callback` en wordt server-side omgewisseld voor een access_token en refresh_token.
- **Zermelo** — optioneel koppelen met de 12-cijferige koppelingscode uit de Zermelo-portal; die wordt via `/api/auth/zermelo` omgezet naar een access_token. Daarmee werken keuzelessen (KWT), roosterwijzigingen en live bezetting.

Alle API-calls gaan via server-side CORS-proxy's (`/api/magister/[...path]` en `/api/zermelo/[...path]`) en via `/api/auth/...` voor de login. Tokens worden alleen als request-header meegestuurd en blijven in de browser (`localStorage`). Zonder koppeling is er geen data zichtbaar.

### Magister OAuth-client instellen

Een browser kan de app-scheme-redirect van de publieke Magister-appclient (`m6loapp://oauth2redirect/`) niet opvangen. Daarom is een geregistreerde client met een HTTPS-callback nodig. Kopieer `.env.example` naar `.env.local` (of zet de variabelen in Vercel) en vul in:

| Variabele | Verplicht | Standaard |
| --- | --- | --- |
| `NEXT_PUBLIC_MAGISTER_CLIENT_ID` | ja | — |
| `NEXT_PUBLIC_MAGISTER_REDIRECT_URI` | nee | `{origin}/auth/callback` |
| `NEXT_PUBLIC_MAGISTER_SCOPES` | nee | `openid profile offline_access attendance.overview calendar.user grades.read` |
| `NEXT_PUBLIC_MAGISTER_RESPONSE_TYPE` | nee | `code` |

Registreer exact de redirect-URI uit de tweede rij bij je Magister-contactpersoon. Voor de productie-opzet is dat `https://magisterpro.vercel.app/auth/callback`. Is de client confidential, zet dan ook `MAGISTER_CLIENT_SECRET` (alleen server-side). Zonder client-id toont de loginpagina een duidelijke configuratiemelding; de Zermelo-koppeling blijft bruikbaar.

## Techniek

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts en Lucide. Data en voorkeuren worden lokaal bewaard via `localStorage`; de PWA heeft een manifest en service worker.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
