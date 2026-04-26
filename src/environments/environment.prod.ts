// ============================================================
// NEXUS — PRODUCCIÓN
// Este archivo sustituye a environment.ts al compilar con:
//   ng build --configuration=production
// NUNCA subas claves reales a git. Usa variables de entorno
// de tu CI/CD (GitHub Actions, Vercel, etc.) para inyectarlas.
// ============================================================

export const environment = {
  production: true,

  // ----------------------------------------------------------
  // API REST (Spring Boot backend)
  // Cambia el dominio a tu servidor real. Ejemplo:
  //   https://api.nexus-app.es
  // ----------------------------------------------------------
  apiUrl: 'https://api.nexus-app.es',

  // ----------------------------------------------------------
  // Panel de administración (nexus-admin-web-app)
  // URL pública del front de admin, usada para redirects y
  // enlace interno desde el marketplace.
  // ----------------------------------------------------------
  adminUrl: 'https://admin.nexus-app.es',

  // ----------------------------------------------------------
  // URL pública de la aplicación (marketplace)
  // Usada para enlaces compartibles, OG tags, etc.
  // ----------------------------------------------------------
  appUrl: 'https://nexus-app.es',

  // ----------------------------------------------------------
  // URL del sitio de documentación e información (Astro)
  // ----------------------------------------------------------
  aboutUrl: 'https://about.nexus-app.es',

  // ----------------------------------------------------------
  // WebSocket (STOMP over SockJS)
  // En producción debe ser WSS (seguro). Normalmente apunta
  // al mismo servidor que apiUrl.
  // ----------------------------------------------------------
  wsUrl: 'https://api.nexus-app.es',

  // ----------------------------------------------------------
  // Stripe — clave pública (pk_live_...)
  // Obtén la clave en: https://dashboard.stripe.com/apikeys
  // ⚠️  NUNCA pongas la clave SECRETA (sk_live_...) aquí.
  // ----------------------------------------------------------
  stripePublicKey: 'pk_live_REEMPLAZA_CON_TU_CLAVE_PUBLICA_LIVE',

  // ----------------------------------------------------------
  // Google OAuth (One Tap / Sign-In with Google)
  // Consola: https://console.cloud.google.com/apis/credentials
  // Asegúrate de añadir tu dominio de producción a
  // "Authorized JavaScript origins" y "Authorized redirect URIs"
  // ----------------------------------------------------------
  googleClientId: '402251087880-ekp6oaun5jpudvo8et2s7ho203gk0259.apps.googleusercontent.com',

  // ----------------------------------------------------------
  // Google reCAPTCHA v2 / v3 — Site Key (clave pública)
  // Consola: https://www.google.com/recaptcha/admin
  // Añade el dominio de producción en la configuración del sitio.
  // ----------------------------------------------------------
  recaptchaSiteKey: '6LdGSXssAAAAAH_-ZPYEsPYY5zIa1n9sLYyD_eaY',

  // ----------------------------------------------------------
  // Cloudinary — subida de imágenes
  // Cloud name: nombre de tu cuenta en cloudinary.com
  // Upload preset: crea uno UNSIGNED en:
  //   Cloudinary → Settings → Upload → Upload presets
  // En producción considera usar un preset SIGNED + backend
  // para mayor seguridad.
  // ----------------------------------------------------------
  cloudinaryCloudName: 'dzahpgslo',
  cloudinaryUploadPreset: 'nexus_unsigned',

  // ----------------------------------------------------------
  // Google AdSense
  // adsenseClient → ID de editor: ca-pub-XXXXXXXXXXXXXXXX
  //   Encuéntralo en https://www.google.com/adsense → Cuenta
  // adsenseSlotFooter → ID del bloque de anuncio (número 10 dígitos)
  //   Crea una unidad en AdSense → Anuncios → Por unidad de anuncio
  //   y copia el "Ad slot" que aparece en el código generado.
  // ⚠️  Los anuncios NO se muestran en localhost; solo en el
  //     dominio verificado en tu cuenta de AdSense.
  // ----------------------------------------------------------
  adsenseClient: 'ca-pub-6663448717051907',
  adsenseSlotFooter: '8976956092',

  // ----------------------------------------------------------
  // AdSense slot específico del buscador (search.component)
  // Crea una unidad de anuncio en AdSense para la sección de
  // búsqueda y pega el slot ID aquí.
  // En search.component.html el atributo data-ad-slot ya está
  // configurado con este valor.
  // ----------------------------------------------------------
  adsenseSlotSearch: '6885786825',
};
