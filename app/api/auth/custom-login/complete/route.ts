/**
 * Protocol-compatibel met de open-source Discipulus auth-gateway.
 * De app post de tokens naar `/api/auth/custom-login/complete`; onze QR-store
 * zit achter `/api/auth/magister/qr/complete`. Deel dezelfde implementatie.
 */
export {
  POST,
  OPTIONS,
  runtime,
  dynamic,
} from "../../magister/qr/complete/route";
