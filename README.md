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

- **Magister** — in de native MagisterPro-app open je de échte Magister-loginpagina (inclusief MFA en school-SSO). De app vangt de `m6loapp://oauth2redirect/`-redirect op en wisselt de code server-side om. In een gewone browser blijft de QR-koppeling met een companion-app beschikbaar. Je wachtwoord komt nooit in MagisterPro terecht en er is geen geregistreerde webclient nodig.
- **Zermelo** — optioneel koppelen met de 12-cijferige koppelingscode uit de Zermelo-portal; die wordt via `/api/auth/zermelo` omgezet naar een access_token. Daarmee werken keuzelessen (KWT), roosterwijzigingen en live bezetting.

Alle API-calls gaan via server-side CORS-proxy's (`/api/magister/[...path]` en `/api/zermelo/[...path]`) en via `/api/auth/...` voor de login. Tokens worden alleen als request-header meegestuurd en blijven in de browser (`localStorage`). Zonder koppeling is er geen data zichtbaar.

### Magister-login in de native app (geen andere app nodig)

De publieke Magister-appclient `M6LOAPP` stuurt de autorisatiecode terug naar `m6loapp://oauth2redirect/`. Een gewone browser kan dat scheme niet opvangen; de native MagisterPro-shell wel. De flow is identiek aan die van de officiële app:

1. De webapp maakt een PKCE-verifier/challenge en een willekeurige `state`, en bouwt de authorize-URL voor `accounts.magister.net`.
2. De shell opent die URL (Electron: eigen venster; Android/iOS: systeembrowser). De leerling logt in op de echte Magister-pagina, inclusief MFA/SSO.
3. Magister redirect naar `m6loapp://oauth2redirect/#code=…&state=…`. De shell onderschept die navigatie en geeft code + state aan de webapp terug.
4. `/api/auth/magister/native/token` wisselt de code om met `client_id=M6LOAPP`, `grant_type=authorization_code`, `redirect_uri=m6loapp://oauth2redirect/` en de PKCE-verifier — zonder client secret.
5. De API-basisurl wordt opgehaald uit `https://magister.net/.well-known/host-meta.json?rel=magister-api`; de tokens blijven in `localStorage`.

Bestanden: `lib/native/magister-auth.ts` (brug + PKCE), `electron/main.cjs` + `electron/preload.cjs` (desktop), `android/app/src/main/AndroidManifest.xml` en `ios/App/App/Info.plist` (scheme-registratie), `ios/App/App/AppDelegate.swift` (callback-forwarding).

```bash
# Desktop (standaard: https://magisterpro.vercel.app)
npm run electron
# Desktop tegen lokale server op poort 3000
npm run electron:dev

# Mobiel: native projecten zijn al toegevoegd
MAGISTERPRO_URL=https://magisterpro.vercel.app npx cap sync android   # daarna build in Android Studio
MAGISTERPRO_URL=https://magisterpro.vercel.app npx cap sync ios       # op macOS, daarna build in Xcode
```

Op Android kan het systeem een keuzedialog tonen als de officiële Magister-app hetzelfde `m6loapp`-scheme heeft geregistreerd; kies dan MagisterPro.

### Magister QR-koppeling in de browser

Buiten de native shell gebruikt MagisterPro de QR-handshake van de open-source [magister-auth-gateway](https://github.com/DiscipulusApp/magister-auth-gateway): de webapp is zelf de tijdelijke gateway-backend.

1. `/api/auth/magister/qr/initiate` maakt een willekeurige `requestId` (5 minuten geldig).
2. De loginpagina toont een QR-code naar `/discipulus/login?requestId=…&backendUrl=…&requireRefreshToken=true` op de eigen origin (geen 404 bij scannen met een gewone camera), plus een knop die via `discipulus://login?...` direct de [Discipulus-app](https://github.com/DiscipulusApp/Discipulus) opent.
3. De companion-app (Discipulus, Android/iOS) voert de echte Magister-OAuth uit en POST de tokens naar `/api/auth/custom-login/complete` — dezelfde implementatie als `/api/auth/magister/qr/complete`.
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
