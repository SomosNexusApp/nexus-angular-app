import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'], // Reutilizaremos estilos base
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // Estados
  isSubmitted = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');

  forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get f() {
    return this.forgotForm.controls;
  }

  onSubmit() {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');
    const email = this.forgotForm.value.email;

    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 404 || err.status === 400) {
          this.errorMsg.set('No existe ninguna cuenta con ese correo electrónico.');
        } else {
          this.errorMsg.set('Ha ocurrido un error. Por favor, inténtalo de nuevo.');
        }
      },
    });
  }
}
