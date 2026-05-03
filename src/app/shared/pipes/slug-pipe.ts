import { Pipe, PipeTransform } from '@angular/core';
import { createFriendlySlug } from '../utils/slug-utils';

@Pipe({
  name: 'slugify',
  standalone: true
})
export class SlugPipe implements PipeTransform {
  /**
   * Transforma un ID y un título en un slug amigable.
   * Uso: {{ item.id | slugify:item.titulo }}
   */
  transform(id: any, titulo: any): string {
    if (id === undefined || id === null || id === '') return '';
    return createFriendlySlug(titulo || '', id);
  }
}
