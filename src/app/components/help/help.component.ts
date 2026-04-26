import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css'],
})
export class HelpComponent {
  activeSection = signal('cuenta');
  searchQuery = signal('');

  setSection(section: string) {
    this.activeSection.set(section);
    this.searchQuery.set(''); // Limpiar búsqueda al cambiar de sección
  }

  updateSearch(query: string) {
    this.searchQuery.set(query);
  }

  faqs = [
    // CUENTA
    {
      pregunta: '¿Cómo puedo verificar mi cuenta?',
      respuesta:
        'Puedes verificar tu cuenta en los ajustes de perfil vinculando tu número de teléfono o una cuenta de Google. Una cuenta verificada genera más confianza.',
      categoria: 'cuenta',
    },
    {
      pregunta: '¿Cómo cambio mi contraseña?',
      respuesta:
        'Ve a Configuración > Seguridad. Allí podrás introducir tu contraseña actual y la nueva. Te recomendamos usar una combinación de letras, números y símbolos.',
      categoria: 'cuenta',
    },
    {
      pregunta: '¿Puedo eliminar mi cuenta permanentemente?',
      respuesta:
        'Sí, desde el apartado de Configuración > Cuenta. Ten en cuenta que esta acción es irreversible y perderás tu historial de compras y ventas.',
      categoria: 'cuenta',
    },

    // COMPRAS
    {
      pregunta: '¿Qué formas de pago se aceptan?',
      respuesta:
        'Aceptamos tarjetas de crédito/débito, Apple Pay y Google Pay a través de nuestra pasarela de pagos segura gestionada por Stripe.',
      categoria: 'compras',
    },
    {
      pregunta: '¿Qué es el Pago Seguro de Nexus?',
      respuesta:
        'Es un sistema que retiene el dinero del comprador hasta que este confirma que ha recibido el producto en buen estado. Así protegemos a ambas partes.',
      categoria: 'compras',
    },
    {
      pregunta: '¿Cómo solicito una devolución?',
      respuesta:
        'Si el producto no coincide con la descripción, tienes 48h desde la recepción para abrir una disputa desde los detalles de tu compra.',
      categoria: 'compras',
    },

    // VENDER
    {
      pregunta: '¿Es gratis publicar en Nexus?',
      respuesta:
        'Sí, publicar anuncios básicos en Nexus es totalmente gratuito. Solo cobramos una pequeña comisión si decides usar nuestro sistema de pagos y envíos protegidos.',
      categoria: 'vender',
    },
    {
      pregunta: '¿Cómo puedo destacar mi anuncio?',
      respuesta:
        'Desde "Mis anuncios", selecciona el producto y pulsa en "Promocionar". Esto hará que aparezca en las primeras posiciones de búsqueda.',
      categoria: 'vender',
    },
    {
      pregunta: '¿Cuándo recibiré el dinero de mi venta?',
      respuesta:
        'Una vez el comprador reciba el paquete y confirme que todo está bien (o pasen 48h sin reclamaciones), el dinero se transferirá a tu monedero Nexus.',
      categoria: 'vender',
    },

    // ENVIOS
    {
      pregunta: '¿Cómo funcionan los envíos integrados?',
      respuesta:
        'Nexus genera una etiqueta automática. Solo tienes que imprimirla y llevar el paquete a un punto de recogida asociado (Correos o GLS).',
      categoria: 'envios',
    },
    {
      pregunta: '¿Quién paga los gastos de envío?',
      respuesta:
        'Por defecto, los gastos de envío los asume el comprador, a menos que el vendedor decida ofrecer "Envío gratis" en la configuración del producto.',
      categoria: 'envios',
    },
    {
      pregunta: '¿Qué peso máximo puedo enviar?',
      respuesta:
        'Nuestro sistema admite paquetes de hasta 30kg. Para objetos más grandes, deberás gestionar el transporte de forma externa.',
      categoria: 'envios',
    },

    // SEGURIDAD
    {
      pregunta: '¿Cómo reconozco un intento de estafa?',
      respuesta:
        'Desconfía de usuarios que quieran continuar la conversación fuera de Nexus o que te pidan pagos por métodos no oficiales (Bizum directo, transferencias, etc.).',
      categoria: 'seguridad',
    },
    {
      pregunta: '¿Qué es la moderación de contenido?',
      respuesta:
        'Nexus utiliza IA y moderadores humanos para asegurar que no se publiquen artículos prohibidos o lenguaje ofensivo en nuestra plataforma.',
      categoria: 'seguridad',
    },
    {
      pregunta: '¿Cómo denuncio a un usuario?',
      respuesta:
        'En el perfil del usuario o en el chat, pulsa sobre los tres puntos y selecciona "Reportar usuario" especificando el motivo.',
      categoria: 'seguridad',
    },
    // MAS INFO
    {
      pregunta: '¿Qué hacer si no recibo mi pedido?',
      respuesta:
        'Si el plazo de entrega ha vencido y no tienes noticias, pulsa en "Tengo un problema" en el detalle del pedido para que Nexus intervenga.',
      categoria: 'compras',
    },
    {
      pregunta: '¿Cómo funcionan los pagos directos?',
      respuesta:
        'Los pagos directos por fuera de Nexus no están protegidos. Recomendamos usar siempre el botón "Comprar" para asegurar tu dinero.',
      categoria: 'seguridad',
    },
    {
      pregunta: '¿Cómo cambiar mi nombre de usuario?',
      respuesta:
        'El nombre de usuario es único y solo puede cambiarse una vez cada 6 meses desde Configuración > Perfil.',
      categoria: 'cuenta',
    },
    {
      pregunta: '¿Qué es el estado "En revisión"?',
      respuesta:
        'Significa que nuestro sistema de moderación está verificando que tu anuncio cumple con las normas de la comunidad.',
      categoria: 'vender',
    },
    // MAS INFO ADICIONAL
    {
      pregunta: '¿Cómo funcionan los cupones de descuento?',
      respuesta:
        'Si tienes un código, introdúcelo en el resumen de tu compra antes de pagar. El descuento se aplicará automáticamente al total.',
      categoria: 'compras',
    },
    {
      pregunta: '¿Puedo cambiar la dirección de envío una vez comprado?',
      respuesta:
        'No es posible cambiarla por seguridad. Si te has equivocado, solicita la cancelación al vendedor antes de que envíe el paquete.',
      categoria: 'envios',
    },
    {
      pregunta: '¿Qué es la suscripción Nexus Pro?',
      respuesta:
        'Es un plan premium para vendedores que reduce comisiones, permite subir anuncios ilimitados y ofrece estadísticas avanzadas.',
      categoria: 'vender',
    },
    {
      pregunta: '¿Cómo reportar un mensaje ofensivo en el chat?',
      respuesta:
        'Mantén pulsado el mensaje (o pulsa los tres puntos en PC) y selecciona "Reportar mensaje" para que lo revisemos.',
      categoria: 'seguridad',
    },
    {
      pregunta: '¿Cómo vincula Nexus mi cuenta bancaria?',
      respuesta:
        'Usamos Stripe Connect para procesar transferencias de forma segura. La vinculación se hace desde Mi Cuenta > Pagos y Cobros.',
      categoria: 'cuenta',
    },
    {
      pregunta: '¿Qué pasa si mi paquete se pierde?',
      respuesta:
        'Si has usado el envío de Nexus, el paquete está asegurado por su valor total. Abriremos una reclamación con la empresa de transporte.',
      categoria: 'envios',
    },
    {
      pregunta: '¿Por qué no puedo subir más de X fotos?',
      respuesta:
        'El límite gratuito es de 8 fotos por producto. Usuarios Pro pueden subir hasta 20 fotos para mostrar más detalle.',
      categoria: 'vender',
    },
    {
      pregunta: '¿Cómo cancelar una compra?',
      respuesta:
        'Puedes cancelar una compra en "Mis Compras" siempre que el vendedor aún no haya generado la etiqueta de envío.',
      categoria: 'compras',
    },
    {
      pregunta: '¿Cómo actualizar la aplicación?',
      respuesta:
        'Nexus es una PWA (Progressive Web App). Se actualiza automáticamente cada vez que la abres. No necesitas descargar nada de la store.',
      categoria: 'cuenta',
    },
    {
      pregunta: '¿Qué es el seguro de protección al comprador?',
      respuesta:
        'Es una pequeña tasa que aplicamos para garantizar que recuperas tu dinero si algo sale mal con el producto o el envío.',
      categoria: 'compras',
    },

    // VIAJES (NEW)
    {
      pregunta: '¿Cómo funcionan las ofertas de viajes en Nexus?',
      respuesta:
        'Nexus selecciona las mejores ofertas de agencias colaboradoras. Puedes ver los detalles, disponibilidad y reservar directamente desde la ficha de la oferta usando nuestra pasarela de pago.',
      categoria: 'viajes',
    },
    {
      pregunta: '¿Qué incluye el precio de un viaje?',
      respuesta:
        'Cada oferta es única. En la sección "Qué incluye" de la oferta verás detallado si incluye vuelos, hotel, traslados o régimen de comidas (TI, PC, MP).',
      categoria: 'viajes',
    },
    {
      pregunta: '¿Puedo cancelar una reserva de viaje?',
      respuesta:
        'Las políticas de cancelación dependen de la oferta y la antelación. Consulta las condiciones específicas en tu correo de confirmación o contacta con el soporte de Viajes.',
      categoria: 'viajes',
    },
    {
      pregunta: '¿Necesito seguro de viaje?',
      respuesta:
        'Recomendamos encarecidamente contratar un seguro. Muchas de nuestras ofertas premium ya lo incluyen de serie, revisa los detalles en la ficha del viaje.',
      categoria: 'viajes',
    },

    // VEHICULOS (NEW)
    {
      pregunta: '¿Cómo contacto con un vendedor de un vehículo?',
      respuesta:
        'Puedes usar el chat directo de Nexus para preguntar detalles. En vehículos de concesionarios, a veces verás un botón de "Llamar" para contacto telefónico directo.',
      categoria: 'vehiculos',
    },
    {
      pregunta: '¿Nexus revisa el estado de los vehículos?',
      respuesta:
        'Nexus es una plataforma de anuncios. Recomendamos siempre ver el vehículo en persona y, si es posible, realizar una revisión mecánica antes de completar la compra.',
      categoria: 'vehiculos',
    },
    {
      pregunta: '¿Qué filtros puedo aplicar en Nexus Motor?',
      respuesta:
        'Puedes filtrar por marca, modelo, año, kilometraje, tipo de combustible (Eco, Híbrido, Eléctrico) y ubicación para encontrar lo que buscas cerca de ti.',
      categoria: 'vehiculos',
    },
    {
      pregunta: '¿Cómo se gestiona el cambio de nombre de un coche?',
      respuesta:
        'La transferencia de titularidad debe gestionarse de forma externa a la app, aunque en Nexus Motor ofrecemos guías y contactos de gestorías colaboradoras para facilitarte el trámite.',
      categoria: 'vehiculos',
    },

    // NEXUS ELITE & PRO (NEW)
    {
      pregunta: '¿Qué ventajas tiene el diseño Nexus Elite?',
      respuesta:
        'Es nuestra nueva interfaz ultra-fluida con glassmorphing avanzado, diseñada para que navegar sea una experiencia visual espectacular y extremadamente rápida.',
      categoria: 'elite',
    },
    {
      pregunta: '¿Cómo activar las herramientas profesionales?',
      respuesta:
        'Si eres un profesional o empresa, ve a Configuración > Cuenta y selecciona "Convertir a Profesional". Desbloquearás estadísticas de ventas y gestión de stock avanzada.',
      categoria: 'elite',
    },
    {
      pregunta: '¿Qué es el Mega Menú inteligente?',
      respuesta:
        'Es el nuevo sistema de navegación que te muestra preventas y ofertas destacadas con solo pasar el ratón por las categorías principales del header.',
      categoria: 'elite',
    },

    // SOPORTE TECNICO (NEW)
    {
      pregunta: '¿Cómo instalo Nexus como aplicación en mi móvil?',
      respuesta:
        'Al abrir Nexus en Chrome (Android) o Safari (iOS), pulsa en "Añadir a pantalla de inicio". Se instalará como una PWA ligera que funciona igual que una app nativa.',
      categoria: 'tecnico',
    },
    {
      pregunta: 'No recibo notificaciones de mensajes, ¿qué hago?',
      respuesta:
        'Asegúrate de haber dado permiso de notificaciones en tu navegador. Puedes revisar esto en Configuración > Privacidad y Seguridad dentro de Nexus.',
      categoria: 'tecnico',
    },
    {
      pregunta: '¿Nexus funciona sin conexión a internet?',
      respuesta:
        'Como PWA, Nexus puede mostrarte contenido cacheado recientemente (tus favoritos o últimos chats), pero necesitarás conexión para enviar mensajes o realizar compras.',
      categoria: 'tecnico',
    },
    {
      pregunta: 'La imágenes tardan en cargar, ¿es normal?',
      respuesta:
        'Nexus optimiza las imágenes automáticamente para tu dispositivo. Si tardan, revisa tu conexión. En modo "Ahorro de datos", la calidad se reduce para mayor velocidad.',
      categoria: 'tecnico',
    },

    // MÁS SOBRE SEGURIDAD
    {
      pregunta: '¿Cómo sé si un vendedor es de confianza?',
      respuesta:
        'Fíjate en las estrellas de valoración, el número de ventas completadas y si tiene el sello de "Usuario Verificado" (check azul).',
      categoria: 'seguridad',
    },
    {
      pregunta: '¿Es seguro dar mi número de teléfono?',
      respuesta:
        'Recomendamos usar siempre el chat de Nexus. No compartas tu teléfono a menos que vayas a cerrar una venta en persona y te sientas seguro.',
      categoria: 'seguridad',
    },
  ];

  filteredFaqs = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.faqs.filter(
        (f) => this.activeSection() === 'todas' || f.categoria === this.activeSection(),
      );
    }
    return this.faqs.filter(
      (f) => f.pregunta.toLowerCase().includes(query) || f.respuesta.toLowerCase().includes(query),
    );
  });
}
