// ============================================================
// NEXUS — DESARROLLO LOCAL
// Este archivo se usa al ejecutar: ng serve (o ng build sin --configuration=production)
// En producción es sustituido por environment.prod.ts automáticamente.
// ============================================================

export const environment = {
  production: false,

  // Backend Spring Boot local
  apiUrl: 'http://localhost:8080',

  // Panel de administración local
  adminUrl: 'http://localhost:4200/admin',

  // URL base de la app (para links compartibles en desarrollo)
  appUrl: 'http://localhost:4200',

  // URL del sitio de documentación e información (Astro)
  aboutUrl: 'http://localhost:4321',

  // WebSocket local (STOMP sobre SockJS, sin wss en local)
  wsUrl: 'http://localhost:8080',

  // Stripe — clave de TEST (pk_test_...)
  // Obtén tu clave test en: https://dashboard.stripe.com/test/apikeys
  stripePublicKey:
    'pk_test_51Sw0iBIN0ui8iBNBrpgL2Fv5n6aMkMLnyxlv5Sjt5wxcYlhSwgnFG0Q2opkRNyPVlIb7h7TPuyCVPRoNPUKvTW2Q00H0C83QTe',

  // Google OAuth (One Tap)
  googleClientId: '402251087880-ekp6oaun5jpudvo8et2s7ho203gk0259.apps.googleusercontent.com',

  // reCAPTCHA — site key (funciona en localhost si está en la lista blanca)
  recaptchaSiteKey: '6LdGSXssAAAAAH_-ZPYEsPYY5zIa1n9sLYyD_eaY',

  // Cloudinary — subida de imágenes
  cloudinaryCloudName: 'dzahpgslo',
  cloudinaryUploadPreset: 'nexus_unsigned',

  // Google AdSense
  // ⚠️  Los anuncios NO se muestran en localhost.
  // Para probar el slot en local usa el modo de anuncios de prueba de AdSense.
  adsenseClient: 'ca-pub-6663448717051907',
  adsenseSlotFooter: '8976956092',
  adsenseSlotSearch: '6885786825',
};
