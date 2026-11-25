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

- **Magister** — QR-koppeling via de Magister-companion-app (hetzelfde protocol als de open-source auth-gateway). Je scant een tijdelijke QR-code met je telefoon; de app doet de officiële Magister-OAuth en stuurt de tokens naar onze backend. Je wachtwoord komt nooit in MagisterPro terecht en er is geen geregistreerde webclient nodig.
- **Zermelo** — optioneel koppelen met de 12-cijferige koppelingscode uit de Zermelo-portal; die wordt via `/api/auth/zermelo` omgezet naar een access_token. Daarmee werken keuzelessen (KWT), roosterwijzigingen en live bezetting.

Alle API-calls gaan via server-side CORS-proxy's (`/api/magister/[...path]` en `/api/zermelo/[...path]`) en via `/api/auth/...` voor de login. Tokens worden alleen als request-header meegestuurd en blijven in de browser (`localStorage`). Zonder koppeling is er geen data zichtbaar.

### Magister QR-koppeling

Een browser kan de app-scheme-redirect van de publieke Magister-appclient (`m6loapp://oauth2redirect/`) niet opvangen. Daarom gebruikt MagisterPro de QR-handshake van de open-source [magister-auth-gateway](https://github.com/DiscipulusApp/magister-auth-gateway): de webapp is zelf de tijdelijke gateway-backend.

1. `/api/auth/magister/qr/initiate` maakt een willekeurige `requestId` (5 minuten geldig).
2. De loginpagina toont een QR-code met `requestId` en de eigen origin als `backendUrl`.
3. De companion-app voert de echte Magister-OAuth uit en POST de tokens naar `/api/auth/magister/qr/complete`.
4. De browser poll `/api/auth/magister/qr/status/[requestId]` en slaat de tokens daarna lokaal op.
5. Verlopen tokens worden via `/api/auth/magister/token` vernieuwd (publieke client `iam-profile`).

De koppelsessies leven kort in Vercel Blob (`BLOB_READ_WRITE_TOKEN`, automatisch aan dit project verbonden). Zonder die token gebruikt een lokale ontwikkelomgeving een in-memory opslag. Er is geen extra service of geregistreerde OAuth-client nodig. De QR-code kan alleen worden gescand met een app die dit gateway-protocol ondersteunt.

## Techniek

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts en Lucide. Data en voorkeuren worden lokaal bewaard via `localStorage`; de PWA heeft een manifest en service worker.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
