export type MarketplaceType = 'PRODUCTO' | 'OFERTA' | 'VEHICULO';

export interface MarketplaceItem {
  id: number;
  titulo: string;
  imagenPrincipal?: string;
  galeriaImagenes?: string[];
  precio?: number;
  precioOriginal?: number;
  precioOferta?: number;
  ubicacion?: string;
  fechaPublicacion?: string | Date;
  searchType?: MarketplaceType;
  // Campos comunes opcionales
  vendedor?: { nombre?: string; verificado?: boolean; avatar?: string };
  categoria?: { nombre: string; slug: string };
  estado?: string;
  condicion?: string;
  /** Destacado por contrato publicitario pagado */
  patrocinado?: boolean;
  // Campos de oferta
  codigoDescuento?: string;
  badge?: string;
  destacada?: boolean;
  esFlash?: boolean;
  sparkScore?: number;
  tienda?: string;
}

