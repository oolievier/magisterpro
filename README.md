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

- **Magister** — log in met je school (`*.magister.net`), gebruikersnaam en wachtwoord via de officiële Magister-schoollogin. Geavanceerd: een door de school geregistreerde OAuth-webclient met PKCE (`/auth/callback`) kan ook worden gebruikt. Het access_token wordt na het inloggen opgehaald en indien mogelijk vernieuwd via `refresh_token`.
- **Zermelo** — optioneel koppelen met de 12-cijferige koppelingscode uit de Zermelo-portal; die wordt via `/api/auth/zermelo` omgezet naar een access_token. Daarmee werken keuzelessen (KWT), roosterwijzigingen en live bezetting.

Alle API-calls gaan via server-side CORS-proxy's (`/api/magister/[...path]` en `/api/zermelo/[...path]`) en via `/api/auth/...` voor de login. Tokens worden alleen als request-header meegestuurd en blijven in de browser (`localStorage`). Zonder koppeling is er geen data zichtbaar.

## Techniek

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts en Lucide. Data en voorkeuren worden lokaal bewaard via `localStorage`; de PWA heeft een manifest en service worker.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
