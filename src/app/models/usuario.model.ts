import { Actor } from './actor.model';

export type TipoCuenta = 'PERSONAL' | 'EMPRESA';

export interface DireccionEnvio {
  nombre?: string;
  apellidos?: string;
  direccion?: string;
  pisoPuerta?: string;
  ciudad?: string;
  codigoPostal?: string;
  pais?: string;
  telefono?: string;
}

export interface Usuario extends Actor {
  biografia?: string;
  ubicacion?: string;
  tipoCuenta: TipoCuenta;
  id: number;
  cuentaPrivada: boolean;
  terminosAceptados: boolean;
  newsletterSuscrito: boolean;
  googleId?: string;
  googleAvatarUrl?: string;
  facebookId?: string;
  isSocial?: boolean;
  versionTerminosAceptados?: string;
  fechaAceptacionTerminos?: string;
  reputacion: number;
  totalVentas: number;
  esVerificado: boolean;
  perfilPublico: boolean;
  mostrarTelefono: boolean;
  mostrarUbicacion: boolean;
  direccionPorDefecto?: DireccionEnvio;
  onboardingCompletado: boolean;
}

